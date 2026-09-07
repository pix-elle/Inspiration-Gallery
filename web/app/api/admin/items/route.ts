import { nanoid } from "nanoid";
import { requireApiSession } from "@/lib/dal";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, headUpload } from "@/lib/r2";
import { dispatchTranscode } from "@/lib/github";
import {
  createProcessingItem,
  findOrCreateBrand,
  getAdminItems,
  revalidateGallery,
} from "@/lib/queries";
import type { ProjectType } from "@/lib/types";

const PROJECT_TYPES: ProjectType[] = ["popup", "store"];

export async function GET() {
  const { session, response } = await requireApiSession();
  if (!session) return response;
  return Response.json({ items: await getAdminItems() });
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

  const sourceKey = String(body.key ?? "");
  if (!sourceKey.startsWith("sources/")) {
    return Response.json({ error: "Fichier introuvable" }, { status: 400 });
  }

  // The browser told us a size and a type before uploading. This reads what
  // actually landed in the bucket — the only version of those facts we didn't
  // take on trust.
  //
  // headUpload() rattrape déjà l'objet absent, mais pas des identifiants R2
  // manquants : ça lève avant même la requête. Sans ce filet, l'exception
  // remonte et Next répond 500 sans corps, ce que le navigateur ne sait pas
  // lire.
  let uploaded: Awaited<ReturnType<typeof headUpload>>;
  try {
    uploaded = await headUpload(sourceKey);
  } catch (err) {
    console.error("Lecture R2 impossible", err);
    return Response.json(
      {
        error:
          "Le stockage R2 n'a pas répondu — vérifie les variables S3_* du déploiement",
      },
      { status: 500 }
    );
  }
  if (!uploaded) {
    return Response.json(
      { error: "L'envoi du fichier ne s'est pas terminé — réessaie" },
      { status: 400 }
    );
  }
  if (uploaded.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Fichier trop lourd" }, { status: 413 });
  }
  const extension = ACCEPTED_TYPES[uploaded.contentType.toLowerCase()];
  if (!extension) {
    return Response.json({ error: "Format non supporté" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim() || null;
  const description = String(body.description ?? "").trim() || null;

  const rawType = String(body.projectType ?? "");
  const projectType = PROJECT_TYPES.includes(rawType as ProjectType)
    ? (rawType as ProjectType)
    : null;

  // Either an existing brand, or a name typed in the field — the second case
  // creates it, or reuses an existing one whose slug matches.
  let brandId: string | null = null;
  const brandName = String(body.brandName ?? "").trim();
  if (body.brandId) {
    brandId = String(body.brandId);
  } else if (brandName) {
    try {
      brandId = (await findOrCreateBrand(brandName)).id;
    } catch (err) {
      console.error("Création de marque impossible", err);
      return Response.json({ error: "Marque non enregistrée" }, { status: 500 });
    }
  }

  const id = nanoid(10);
  try {
    await createProcessingItem({
      id,
      type: uploaded.contentType.startsWith("video/") ? "video" : "image",
      title,
      description,
      projectType,
      brandId,
      sourceKey,
    });
  } catch (err) {
    console.error("Écriture en base impossible", err);
    return Response.json(
      { error: "La base n'a pas accepté l'enregistrement" },
      { status: 500 }
    );
  }

  // Fire and forget: a failure here leaves the row in "processing", which the
  // table shows and which a manual re-run resolves. It must not make the
  // upload itself look like it failed — d'où le catch : la ligne existe, le
  // fichier est sur R2, et renvoyer une erreur ici ferait recommencer un
  // envoi qui a réussi.
  try {
    await dispatchTranscode(id);
  } catch (err) {
    console.error(`Déclenchement de l'encodage impossible pour ${id}`, err);
  }
  revalidateGallery();

  return Response.json({ id }, { status: 201 });
}
