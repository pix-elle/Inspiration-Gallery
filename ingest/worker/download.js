import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";

const EXT_BY_MIME = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};
const ALLOWED_EXT = new Set(Object.values(EXT_BY_MIME));
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB safety cap

// Turn a share link into a direct-download URL. Returns null when the
// service can't be automated (that becomes a readable error for the caller).
export function resolveDownloadUrl(url) {
  const u = new URL(url);

  if (u.hostname.endsWith("dropbox.com")) {
    // Share links serve an HTML preview; dl=1 forces the raw file.
    u.searchParams.set("dl", "1");
    return u.toString();
  }

  if (u.hostname === "drive.google.com" || u.hostname === "docs.google.com") {
    // Accept /file/d/<id>/… and ?id=<id> forms.
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    const id = m?.[1] ?? u.searchParams.get("id");
    if (!id) return null;
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }

  if (u.hostname.endsWith("icloud.com")) return null; // no stable direct URL

  // Anything else: assume it's already a direct file URL.
  return url;
}

// Google interposes an HTML "can't scan for viruses" page for large files;
// the real download form parameters are embedded in it.
async function followDriveConfirm(html) {
  const action = html.match(/action="([^"]+)"/)?.[1];
  if (!action) return null;
  const inputs = [...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)];
  const params = new URLSearchParams();
  for (const [, name, value] of inputs) params.set(name, value);
  return `${action}?${params}`;
}

export async function downloadToTmp(url, { hintName = "" } = {}) {
  let res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Téléchargement impossible (HTTP ${res.status})`);

  // Google Drive virus-scan interstitial → extract the confirm URL and retry.
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0];
  if (contentType === "text/html" && url.includes("drive.google.com")) {
    const confirmUrl = await followDriveConfirm(await res.text());
    if (!confirmUrl) {
      throw new Error(
        "Google Drive a bloqué le téléchargement — vérifie que le partage est sur « Toute personne disposant du lien »"
      );
    }
    res = await fetch(confirmUrl, { redirect: "follow" });
    if (!res.ok) throw new Error(`Téléchargement Drive impossible (HTTP ${res.status})`);
  }

  const finalType = (res.headers.get("content-type") ?? "").split(";")[0];
  // A share link that resolves to a web page (dead link, permission denied,
  // file removed…) must fail here with a readable message — not later as a
  // cryptic FFmpeg error on an HTML file saved as .mp4.
  if (finalType === "text/html") {
    throw new Error(
      "Le lien renvoie une page web au lieu d'un fichier — vérifie que le lien est correct et que le partage est activé"
    );
  }
  const size = Number(res.headers.get("content-length") ?? 0);
  if (size > MAX_BYTES) {
    throw new Error(`Fichier trop lourd (${(size / 1e6).toFixed(0)} Mo, max 500 Mo)`);
  }

  // Extension: content-disposition filename → hint name → URL path → MIME.
  const disposition = res.headers.get("content-disposition") ?? "";
  const dispositionName = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/)?.[1];
  const ext = (
    extname(dispositionName ?? "") ||
    extname(hintName) ||
    extname(new URL(res.url).pathname) ||
    EXT_BY_MIME[finalType] ||
    ""
  ).toLowerCase();

  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(
      `Format non supporté (${ext || finalType || "inconnu"}) — formats acceptés : png, jpg, webp, mp4, mov, webm`
    );
  }

  const dest = join(tmpdir(), `ingest-download-${Date.now()}${ext}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return { path: dest, ext };
}
