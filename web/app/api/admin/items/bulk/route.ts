import { requireApiSession } from "@/lib/dal";
import { deleteUnder } from "@/lib/r2";
import { dispatchTranscode } from "@/lib/github";
import {
  deleteItemRows,
  findOrCreateBrand,
  getAdminItemsByIds,
  markManyForRetry,
  revalidateGalleryMany,
  updateItems,
} from "@/lib/queries";
import type { Item, ItemStatus, ProjectType } from "@/lib/types";

// Segment statique : Next le résout avant /items/[id], et aucun identifiant
// nanoid ne vaut "bulk". Les trois actions partagent ce fichier parce
// qu'elles partagent la validation et la forme de réponse.

const PROJECT_TYPES: ProjectType[] = ["popup", "store"];
const SETTABLE_STATUS: ItemStatus[] = ["published", "unpublished"];
// Deux plafonds, parce que le coût n'est pas le même selon l'action.
// Modifier ou relancer tient dans un seul énoncé SQL : le plafond n'est
// qu'un garde-fou contre une requête aberrante, et il doit rester
// confortablement au-dessus du nombre d'éléments du site.
const MAX_IDS = 2000;
// Supprimer, en revanche, liste et efface les fichiers de chaque item sur R2,
// un préfixe à la fois. Au-delà de quelques centaines, c'est le délai
// d'exécution de la fonction serverless qui lâche — et une suppression
// interrompue à mi-course laisse des fichiers orphelins. Mieux vaut refuser
// franchement que finir à moitié.
const MAX_DELETE = 200;

type Skipped = { id: string; reason: string };

/** Un lot réussit rarement en entier : ce qui passe passe, le reste est motivé. */
type BulkResult = { done: string[]; skipped: Skipped[] };

function readIds(body: Record<string, unknown>): string[] | null {
  if (!Array.isArray(body.ids)) return null;
  const ids = [...new Set(body.ids.map(String).filter(Boolean))];
  return ids.length === 0 ? null : ids;
}

export async function POST(req: Request) {
  const { session, response } = await requireApiSession();
  if (!session) return response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }

  const ids = readIds(body);
  if (!ids) return Response.json({ error: "Sélection vide" }, { status: 400 });

  const action = String(body.action ?? "");
  const cap = action === "delete" ? MAX_DELETE : MAX_IDS;
  if (ids.length > cap) {
    return Response.json(
      {
        error:
          action === "delete"
            ? `Suppression limitée à ${MAX_DELETE} éléments à la fois (nettoyage des fichiers). Sélection : ${ids.length}.`
            : `Sélection limitée à ${MAX_IDS} éléments. Sélection : ${ids.length}.`,
      },
      { status: 400 }
    );
  }
  // Une seule lecture pour tout le lot : c'est elle qui sert à motiver les
  // exclusions, et elle remplace un getAdminItem par élément.
  const found = await getAdminItemsByIds(ids);
  const byId = new Map(found.map((i) => [i.id, i]));
  const missing: Skipped[] = ids
    .filter((id) => !byId.has(id))
    .map((id) => ({ id, reason: "introuvable" }));

  if (action === "update") return update(body, found, missing);
  if (action === "retry") return retry(found, missing);
  if (action === "delete") return remove(found, missing);

  return Response.json({ error: "Action inconnue" }, { status: 400 });
}

async function update(
  body: Record<string, unknown>,
  found: Item[],
  skipped: Skipped[]
): Promise<Response> {
  const edits: Parameters<typeof updateItems>[1] = {};

  if ("projectType" in body) {
    const value = String(body.projectType ?? "");
    edits.projectType = PROJECT_TYPES.includes(value as ProjectType)
      ? (value as ProjectType)
      : null;
  }
  if ("brandId" in body) {
    edits.brandId = body.brandId ? String(body.brandId) : null;
  } else if ("brandName" in body) {
    const name = String(body.brandName ?? "").trim();
    edits.brandId = name ? (await findOrCreateBrand(name)).id : null;
  }

  let eligible = found;

  if ("status" in body) {
    const value = String(body.status ?? "");
    if (!SETTABLE_STATUS.includes(value as ItemStatus)) {
      return Response.json({ error: "Statut non modifiable" }, { status: 400 });
    }
    edits.status = value as ItemStatus;
    // Même garde qu'à l'unité : publier un item que l'encodeur n'a pas fini
    // mettrait une tuile sans média dans la galerie. En lot elle ne fait pas
    // échouer l'opération, elle écarte les concernés et le dit.
    if (value === "published") {
      eligible = [];
      for (const item of found) {
        if (item.video_url || item.image_base) eligible.push(item);
        else skipped.push({ id: item.id, reason: "pas encore encodé" });
      }
    }
  }

  if (Object.keys(edits).length === 0) {
    return Response.json({ error: "Aucune modification demandée" }, { status: 400 });
  }

  const done = eligible.map((i) => i.id);
  await updateItems(done, edits);
  revalidateGalleryMany(done);
  return Response.json({ done, skipped } satisfies BulkResult);
}

async function retry(found: Item[], skipped: Skipped[]): Promise<Response> {
  const eligible: string[] = [];
  for (const item of found) {
    if (item.status !== "failed") {
      skipped.push({ id: item.id, reason: "pas en échec" });
    } else if (!item.source_key) {
      skipped.push({ id: item.id, reason: "pas de fichier source conservé" });
    } else {
      eligible.push(item.id);
    }
  }

  await markManyForRetry(eligible);
  // Un run par item, comme à l'unité : le workflow prend un seul identifiant,
  // et sa clé de concurrence est justement là pour qu'ils ne s'annulent pas.
  // Un envoi qui échoue laisse l'item en "processing" et relançable.
  const failed: Skipped[] = [];
  const done: string[] = [];
  for (const id of eligible) {
    try {
      await dispatchTranscode(id);
      done.push(id);
    } catch (err) {
      failed.push({ id, reason: `encodeur injoignable : ${err}` });
    }
  }

  revalidateGalleryMany(done);
  return Response.json({ done, skipped: [...skipped, ...failed] } satisfies BulkResult);
}

async function remove(found: Item[], skipped: Skipped[]): Promise<Response> {
  // La ligne d'abord : si le nettoyage du stockage échoue, la galerie est
  // déjà correcte et les fichiers restants sont invisibles. L'ordre inverse
  // laisserait un item publié pointant vers des fichiers disparus.
  const deleted = await deleteItemRows(found.map((i) => i.id));
  const done = deleted.map((r) => r.id);
  revalidateGalleryMany(done);

  const prefixes = deleted.flatMap((r) =>
    [`items/${r.id}/`, r.source_key ?? ""].filter(Boolean)
  );
  const filesDeleted = await deleteUnder(prefixes).catch((err) => {
    console.error(`Nettoyage R2 incomplet pour ${done.length} items : ${err}`);
    return 0;
  });

  return Response.json({ done, skipped, filesDeleted });
}
