import { nanoid } from "nanoid";
import { requireApiSession } from "@/lib/dal";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, presignUpload } from "@/lib/r2";

// Hands the browser a one-shot URL to upload a single file to R2. Issued only
// to an authenticated admin, and only for a key this route chose itself —
// the client never gets to name its own destination.
export async function POST(req: Request) {
  const { session, response } = await requireApiSession();
  if (!session) return response;

  let contentType: string;
  let size: number;
  try {
    const body = await req.json();
    contentType = String(body.contentType ?? "").toLowerCase();
    size = Number(body.size ?? 0);
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }

  const extension = ACCEPTED_TYPES[contentType];
  if (!extension) {
    return Response.json(
      {
        error:
          "Format non supporté — vidéos MP4, MOV, WebM ou images JPEG, PNG, WebP, HEIC",
      },
      { status: 400 }
    );
  }

  if (!Number.isFinite(size) || size <= 0) {
    return Response.json({ error: "Taille de fichier invalide" }, { status: 400 });
  }
  if (size > MAX_UPLOAD_BYTES) {
    // Mo, not MiB: the figure Alessia sees must match the one her Finder
    // shows, otherwise a "500 Mo" file gets refused for being 524 Mo.
    const mo = (n: number) => Math.round(n / 1e6);
    return Response.json(
      { error: `Fichier trop lourd (${mo(size)} Mo, maximum ${mo(MAX_UPLOAD_BYTES)} Mo)` },
      { status: 413 }
    );
  }

  // The uploaded original is kept: it's what a re-encode would start from,
  // and it means a change of compression settings never needs the file again.
  const key = `sources/${nanoid(12)}${extension}`;
  const url = await presignUpload(key, contentType);

  return Response.json({ url, key });
}
