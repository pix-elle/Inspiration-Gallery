// Reading a *public* Google Drive folder without any API key.
//
// Drive has no anonymous listing endpoint, but the folder's HTML page ships
// the file list inline (an AF_initDataCallback blob). We pull ids + names
// out of it. That blob is Google's private format and can change without
// notice — when the parse comes back empty, sync-drive.js falls back to
// telling you to pass an explicit --manifest, which never breaks.

const MEDIA_EXT = /\.(mp4|mov|webm|m4v|png|jpe?g|webp)$/i;

export function parseFolderId(url) {
  const u = new URL(url);
  if (u.hostname !== "drive.google.com" && u.hostname !== "docs.google.com") {
    return null;
  }
  // /drive/folders/<id>  •  /drive/u/0/folders/<id>  •  ?id=<id>
  const m = u.pathname.match(/\/folders\/([^/?#]+)/);
  return m?.[1] ?? u.searchParams.get("id");
}

export function parseFileId(url) {
  const u = new URL(url);
  if (u.hostname !== "drive.google.com" && u.hostname !== "docs.google.com") {
    return null;
  }
  const m = u.pathname.match(/\/file\/d\/([^/?#]+)/);
  return m?.[1] ?? u.searchParams.get("id");
}

// Drive ids are 25+ chars of [A-Za-z0-9_-]; a filename with a media
// extension always sits a few fields after its id in the data blob.
const ENTRY_RE =
  /"([\w-]{25,})"[^"]{0,40}(?:"[^"]{0,80}"[^"]{0,40}){0,3}?"([^"]{1,200}\.(?:mp4|mov|webm|m4v|png|jpe?g|webp))"/gi;

export function parseFolderHtml(html) {
  const byId = new Map();
  for (const [, id, name] of html.matchAll(ENTRY_RE)) {
    // Escaped unicode (é) survives the blob verbatim — decode it so
    // titles read correctly.
    const decoded = name.replace(/\\u([\da-f]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    if (!MEDIA_EXT.test(decoded)) continue;
    if (!byId.has(id)) byId.set(id, { id, name: decoded });
  }
  return [...byId.values()];
}

export async function listFolder(folderId) {
  const res = await fetch(`https://drive.google.com/drive/folders/${folderId}`, {
    redirect: "follow",
    // Without a desktop UA Drive serves a stripped page with no data blob.
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  if (!res.ok) {
    throw new Error(
      `Dossier Drive illisible (HTTP ${res.status}) — le partage est-il sur « Toute personne disposant du lien » ?`
    );
  }
  const html = await res.text();
  if (/Sign in|Connexion/.test(html.slice(0, 4000)) && !html.includes("AF_initDataCallback")) {
    throw new Error(
      "Google demande une connexion — passe le partage du dossier sur « Toute personne disposant du lien »"
    );
  }
  return parseFolderHtml(html);
}

// The link the download step actually fetches (handled by download.js,
// virus-scan interstitial included).
export function fileUrl(id) {
  return `https://drive.google.com/file/d/${id}/view`;
}

// "gradient-flow_v2.mp4" → "Gradient flow v2"
export function titleFromName(name) {
  const stem = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stem ? stem[0].toUpperCase() + stem.slice(1) : null;
}
