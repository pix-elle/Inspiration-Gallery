#!/usr/bin/env node
// Local folder → gallery bulk import.
//
// For content you already have on disk — typically a Google Drive folder
// downloaded as a zip, because Drive only allows anonymous downloads on
// folders shared "anyone with the link".
//
// Usage:
//   node worker/import-folder.js ~/Downloads/boutiques --dry-run
//   node worker/import-folder.js ~/Downloads/boutiques --limit 8
//   node worker/import-folder.js ~/Downloads/boutiques --tags inspiration --creator "Alessia"
//
// Walks the folder recursively. The name of the folder a file sits in
// becomes a tag (and the title, when the filename is a camera name like
// IMG_2812.MOV that says nothing) — on a Drive archive sorted by brand,
// that's the only real metadata there is.
//
// Re-running is safe: each row records import_key = "sha256:<hash of the
// file>", so a file already published is skipped — even if it was renamed
// or re-downloaded.
//
// Required env (ingest/.env or web/.env.local): DATABASE_URL + S3_*/CDN_BASE_URL.

import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, extname, join, relative } from "node:path";
import { nanoid } from "nanoid";
import { env, useR2 } from "../lib/env.js";
import { processMedia, isVideoExt, MEDIA_EXT } from "../lib/pipeline.js";
import { insertItem, existingImportKeys } from "../lib/db.js";
import { storageMode } from "../lib/storage.js";

// "IMG_2812 2.MOV", "DSC00413.jpg", "VID_20240115.mp4"… — a camera dumped
// this name, it carries no meaning worth showing in the gallery.
const CAMERA_NAME = /^(img|dsc|vid|mvi|pxl|photo|video|screen ?recording)[\s_-]*\d/i;

// --- arguments ------------------------------------------------------------
const argv = process.argv.slice(2);
const flags = {
  dryRun: false,
  limit: Infinity,
  tags: [],
  creator: null,
  category: null,
  videosOnly: false,
};
const roots = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry-run") flags.dryRun = true;
  else if (a === "--videos-only") flags.videosOnly = true;
  else if (a === "--limit") flags.limit = Number(argv[++i]);
  else if (a === "--tags") flags.tags = argv[++i].split(",").map((t) => t.trim()).filter(Boolean);
  else if (a === "--creator") flags.creator = argv[++i];
  else if (a === "--category") flags.category = argv[++i];
  else if (a.startsWith("--")) {
    console.error(`Option inconnue : ${a}`);
    process.exit(1);
  } else roots.push(a);
}

if (roots.length === 0) {
  console.error(
    "Usage : node worker/import-folder.js <dossier> [--dry-run] [--limit N]\n" +
      "                                   [--videos-only] [--tags a,b] [--creator nom]"
  );
  process.exit(1);
}
if (!Number.isFinite(flags.limit) && flags.limit !== Infinity) {
  console.error("--limit attend un nombre");
  process.exit(1);
}
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL manquant (web/.env.local ou ingest/.env)");
  process.exit(1);
}
if (!flags.dryRun && !useR2) {
  // Local mode writes into web/public/media, which is gitignored — the files
  // would never reach Vercel and the gallery would show broken tiles.
  console.error(
    "Stockage local détecté : les fichiers n'iraient pas sur Vercel.\n" +
      "Renseigne S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / CDN_BASE_URL\n" +
      "dans ingest/.env (voir ingest/.env.example), ou relance avec --dry-run pour juste lister."
  );
  process.exit(1);
}

// --- walk -----------------------------------------------------------------
const skipped = new Map(); // extension → count, for the ignored-files report

async function walk(dir, root, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // __MACOSX/ and ._foo are macOS zip residue, .DS_Store is Finder's.
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(full, root, out);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    if (!MEDIA_EXT.has(ext) || (flags.videosOnly && !isVideoExt(ext))) {
      skipped.set(ext || "(sans extension)", (skipped.get(ext || "(sans extension)") ?? 0) + 1);
      continue;
    }
    out.push({
      path: full,
      ext,
      // The folder the file sits in — "Nike", "pop mart"… — is the metadata.
      folder: basename(dir),
      relative: relative(root, full),
      size: (await stat(full)).size,
    });
  }
  return out;
}

const files = [];
for (const root of roots) {
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) {
    console.error(`Pas un dossier : ${root}`);
    process.exit(1);
  }
  await walk(root, root, files);
}
// Stable order: same run, same result — and --limit takes a predictable slice.
files.sort((a, b) => a.relative.localeCompare(b.relative));

const totalBytes = files.reduce((n, f) => n + f.size, 0);
console.log(
  `→ ${files.length} média(s) trouvé(s), ${(totalBytes / 1e9).toFixed(2)} Go bruts`
);
if (skipped.size > 0) {
  const detail = [...skipped].map(([ext, n]) => `${n}×${ext}`).join(", ");
  console.log(`  (ignorés — format non supporté : ${detail})`);
}

// --- dedupe against what's already published ------------------------------
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

console.log("  calcul des empreintes…");
for (const f of files) f.importKey = `sha256:${await sha256(f.path)}`;

// Two identical files in the tree (Drive archives are full of copies) —
// keep the first, the second would collide on the unique index anyway.
const seen = new Set();
const unique = files.filter((f) => !seen.has(f.importKey) && seen.add(f.importKey));
const duplicates = files.length - unique.length;

const already = await existingImportKeys(unique.map((f) => f.importKey));
let todo = unique.filter((f) => !already.has(f.importKey));

if (duplicates > 0) console.log(`→ ${duplicates} doublon(s) dans le dossier, ignoré(s)`);
if (already.size > 0) console.log(`→ ${already.size} déjà en ligne, ignoré(s)`);

if (todo.length > flags.limit) {
  console.log(`→ --limit ${flags.limit} : ${todo.length - flags.limit} fichier(s) laissé(s) de côté`);
  todo = todo.slice(0, flags.limit);
}
console.log(`→ ${todo.length} à importer — stockage : ${storageMode()}`);

// A folder name is a tag; a camera filename is not a title.
function metaFor(f) {
  const stem = basename(f.relative, f.ext);
  const pretty = (s) => s.replace(/[_-]+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());
  const title = CAMERA_NAME.test(stem) ? pretty(f.folder) : pretty(stem);
  const folderTag = f.folder.toLowerCase().replace(/[_-]+/g, " ").trim();
  return { title, tags: [...new Set([...flags.tags, folderTag])] };
}

if (flags.dryRun) {
  for (const f of todo) {
    const { title, tags } = metaFor(f);
    console.log(
      `  • ${f.relative}  →  « ${title} »  [${tags.join(", ")}]  ${(f.size / 1e6).toFixed(1)} Mo`
    );
  }
  console.log("\n(dry-run — rien n'a été importé)");
  process.exit(0);
}

// --- import ---------------------------------------------------------------
let ok = 0;
let failed = 0;

for (const [i, f] of todo.entries()) {
  const { title, tags } = metaFor(f);
  console.log(`\n• [${i + 1}/${todo.length}] ${f.relative}`);

  try {
    const id = nanoid(10);
    const media = await processMedia(f.path, id, f.ext);

    await insertItem({
      id,
      title,
      description: null,
      tags,
      category: flags.category,
      creator: flags.creator,
      sourceUrl: null,
      importKey: f.importKey,
      ...media,
    });

    console.log(`  ✓ publié — item ${id} « ${title} »`);
    ok++;
  } catch (err) {
    failed++;
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n✓ terminé — ${ok} publié(s), ${failed} en erreur`);
process.exit(failed > 0 && ok === 0 ? 1 : 0);
