import { requireApiSession } from "@/lib/dal";
import {
  deleteBrand,
  findBrandConflict,
  getBrandsWithCounts,
  mergeBrands,
  renameBrand,
  revalidateGallery,
  slugify,
} from "@/lib/queries";

export async function GET() {
  const { session, response } = await requireApiSession();
  if (!session) return response;
  return Response.json({ brands: await getBrandsWithCounts() });
}

// Renommer. Un conflit n'est pas une erreur de saisie : « carrhart » qu'on
// corrige en « Carhartt » alors que « Carhartt » existe déjà est très
// exactement le moment où il faut fusionner. On renvoie donc 409 avec la
// marque qui gêne, pour que l'interface puisse le proposer.
export async function PATCH(req: Request) {
  const { session, response } = await requireApiSession();
  if (!session) return response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }

  const id = String(body.id ?? "");
  const name = String(body.name ?? "").trim();
  if (!id || !name) {
    return Response.json({ error: "Marque ou nom manquant" }, { status: 400 });
  }

  const slug = slugify(name);
  if (!slug) {
    return Response.json(
      { error: "Ce nom ne produit aucun identifiant utilisable" },
      { status: 400 }
    );
  }

  const conflict = await findBrandConflict(name, slug, id);
  if (conflict) {
    return Response.json(
      {
        error: `« ${conflict.name} » occupe déjà ce nom`,
        conflict: { id: conflict.id, name: conflict.name },
      },
      { status: 409 }
    );
  }

  const brand = await renameBrand(id, name);
  if (!brand) return Response.json({ error: "Marque introuvable" }, { status: 404 });

  revalidateGallery();
  return Response.json({ brand, brands: await getBrandsWithCounts() });
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

  if (String(body.action ?? "") !== "merge") {
    return Response.json({ error: "Action inconnue" }, { status: 400 });
  }

  const from = String(body.from ?? "");
  const into = String(body.into ?? "");
  if (!from || !into || from === into) {
    return Response.json({ error: "Fusion invalide" }, { status: 400 });
  }

  const moved = await mergeBrands(from, into);
  revalidateGallery();
  return Response.json({ moved, brands: await getBrandsWithCounts() });
}

export async function DELETE(req: Request) {
  const { session, response } = await requireApiSession();
  if (!session) return response;

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return Response.json({ error: "Marque manquante" }, { status: 400 });

  const removed = await deleteBrand(id);
  if (removed === 0) {
    return Response.json({ error: "Marque introuvable" }, { status: 404 });
  }

  revalidateGallery();
  return Response.json({ ok: true, brands: await getBrandsWithCounts() });
}
