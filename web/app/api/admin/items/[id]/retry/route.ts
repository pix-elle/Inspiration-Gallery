import { requireApiSession } from "@/lib/dal";
import { dispatchTranscode } from "@/lib/github";
import { getAdminItem, markForRetry } from "@/lib/queries";

// Re-runs the encoder on an item that failed. The original is still on R2 —
// that's the whole point of keeping it — so nothing needs re-uploading.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireApiSession();
  if (!session) return response;

  const { id } = await params;
  const item = await getAdminItem(id);
  if (!item) return Response.json({ error: "Item introuvable" }, { status: 404 });
  if (!item.source_key) {
    return Response.json(
      { error: "Pas de fichier source conservé pour cet item" },
      { status: 409 }
    );
  }

  await markForRetry(id);
  await dispatchTranscode(id);
  return Response.json({ ok: true });
}
