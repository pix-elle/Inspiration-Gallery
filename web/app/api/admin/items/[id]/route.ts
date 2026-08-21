import { requireApiSession } from "@/lib/dal";
import { deleteUnder } from "@/lib/r2";
import {
  deleteItemRow,
  findOrCreateBrand,
  getAdminItem,
  revalidateGallery,
  updateItem,
} from "@/lib/queries";
import type { ItemStatus, ProjectType } from "@/lib/types";

const PROJECT_TYPES: ProjectType[] = ["popup", "store"];
// Only these two are a decision Alessia makes. "processing" and "failed"
// describe where the encoder got to, and are written by the runner alone.
const SETTABLE_STATUS: ItemStatus[] = ["published", "unpublished"];

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  const { session, response } = await requireApiSession();
  if (!session) return response;

  const { id } = await params;
  const item = await getAdminItem(id);
  if (!item) return Response.json({ error: "Item introuvable" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }

  const edits: Parameters<typeof updateItem>[1] = {};

  if ("title" in body) edits.title = String(body.title ?? "").trim() || null;
  if ("description" in body) {
    edits.description = String(body.description ?? "").trim() || null;
  }
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
  if ("status" in body) {
    const value = String(body.status ?? "");
    if (!SETTABLE_STATUS.includes(value as ItemStatus)) {
      return Response.json({ error: "Statut non modifiable" }, { status: 400 });
    }
    // Publishing something the encoder never finished would put a tile with
    // no media into the gallery.
    if (value === "published" && !item.video_url && !item.image_base) {
      return Response.json(
        { error: "Cet item n'a pas encore de média encodé" },
        { status: 409 }
      );
    }
    edits.status = value as ItemStatus;
  }

  await updateItem(id, edits);
  revalidateGallery(id);
  return Response.json({ item: await getAdminItem(id) });
}

export async function DELETE(_req: Request, { params }: Context) {
  const { session, response } = await requireApiSession();
  if (!session) return response;

  const { id } = await params;
  const deleted = await deleteItemRow(id);
  if (!deleted) return Response.json({ error: "Item introuvable" }, { status: 404 });
  revalidateGallery(id);

  // The row goes first: if storage cleanup fails, the gallery is already
  // correct and the leftovers are invisible. The reverse order could leave a
  // published item pointing at files that no longer exist.
  const removed = await deleteUnder(
    [`items/${id}/`, deleted.sourceKey ?? ""].filter(Boolean)
  ).catch((err) => {
    console.error(`Nettoyage R2 incomplet pour ${id} : ${err}`);
    return 0;
  });

  return Response.json({ ok: true, filesDeleted: removed });
}
