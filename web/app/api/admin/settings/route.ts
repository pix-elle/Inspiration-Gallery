import { requireApiSession } from "@/lib/dal";
import { getSettings, updateSettings, SETTING_KEYS } from "@/lib/settings";
import { revalidateGallery } from "@/lib/queries";

export async function GET() {
  const { session, response } = await requireApiSession();
  if (!session) return response;
  return Response.json({ settings: await getSettings() });
}

export async function PATCH(req: Request) {
  const { session, response } = await requireApiSession();
  if (!session) return response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }

  // Only known keys, and only strings: the table is a settings store, not a
  // place for the client to write whatever it likes.
  const edits: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    if (key in body) edits[key] = String(body[key] ?? "");
  }
  if (Object.keys(edits).length === 0) {
    return Response.json({ error: "Aucun réglage reconnu" }, { status: 400 });
  }

  await updateSettings(edits);
  // The copy lives in pages cached for five minutes; without this, a reworded
  // sentence would take that long to appear and read as if it hadn't saved.
  revalidateGallery();

  return Response.json({ settings: await getSettings() });
}
