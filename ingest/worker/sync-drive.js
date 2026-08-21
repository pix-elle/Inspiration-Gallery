#!/usr/bin/env node
// Google Drive → gallery bulk import.
//
// One-shot companion to sync-notion.js: takes a shared Drive folder (or a
// handful of file links) and pushes every video/image through the exact same
// pipeline — compress, upload to storage, insert the row.
//
// Usage:
//   node worker/sync-drive.js <lien-dossier-ou-fichier> [...]
//   node worker/sync-drive.js --dry-run <lien>        # liste sans rien importer
//   node worker/sync-drive.js --manifest fichiers.json
//   node worker/sync-drive.js --tags "motion,3d" --creator "Alessia" <lien>
//
// --manifest takes [{ "id": "<drive file id>", "name": "clip.mp4" }, …] and
// is the escape hatch when the folder page can't be parsed (or isn't public).
//
// Re-running is safe: every row records import_key = "drive:<id>" and
// already-imported files are skipped.
//
// Required env (ingest/.env or web/.env.local): DATABASE_URL + S3_*/CDN_BASE_URL.

import { readFile, unlink } from "node:fs/promises";
import { nanoid } from "nanoid";
import { env, useR2 } from "../lib/env.js";
import { processMedia, isVideoExt } from "../lib/pipeline.js";
import { insertItem, existingImportKeys } from "../lib/db.js";
import { storageMode } from "../lib/storage.js";
import { downloadToTmp, resolveDownloadUrl } from "./download.js";
import {
  listFolder,
  parseFolderId,
  parseFileId,
  fileUrl,
  titleFromName,
} from "./drive.js";

// --- arguments ------------------------------------------------------------
const argv = process.argv.slice(2);
const flags = { dryRun: false, manifest: null, tags: [], creator: null, category: null };
const urls = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry-run") flags.dryRun = true;
  else if (a === "--manifest") flags.manifest = argv[++i];
  else if (a === "--tags") flags.tags = argv[++i].split(",").map((t) => t.trim()).filter(Boolean);
  else if (a === "--creator") flags.creator = argv[++i];
  else if (a === "--category") flags.category = argv[++i];
  else if (a.startsWith("--")) {
    console.error(`Option inconnue : ${a}`);
    process.exit(1);
  } else urls.push(a);
}

if (!flags.manifest && urls.length === 0) {
  console.error(
    "Usage : node worker/sync-drive.js <lien-dossier-Drive> [--dry-run] [--tags a,b] [--creator nom]"
  );
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

// --- what do we import? ---------------------------------------------------
let files = [];

if (flags.manifest) {
  files = JSON.parse(await readFile(flags.manifest, "utf8"));
} else {
  for (const url of urls) {
    const folderId = parseFolderId(url);
    if (folderId) {
      const found = await listFolder(folderId);
      if (found.length === 0) {
        throw new Error(
          `Aucun média lisible dans le dossier ${folderId}.\n` +
            "Soit le partage n'est pas public, soit la page Drive a changé de format :\n" +
            "dans ce cas passe la liste à la main avec --manifest (voir l'entête du script)."
        );
      }
      console.log(`→ dossier ${folderId} : ${found.length} fichier(s)`);
      files.push(...found);
      continue;
    }
    const fileId = parseFileId(url);
    if (!fileId) throw new Error(`Lien Drive non reconnu : ${url}`);
    files.push({ id: fileId, name: "" });
  }
}

// Dedupe within the run, then against what's already published.
const seen = new Set();
files = files.filter((f) => !seen.has(f.id) && seen.add(f.id));

const keys = files.map((f) => `drive:${f.id}`);
const already = flags.dryRun ? new Set() : await existingImportKeys(keys);
const todo = files.filter((f) => !already.has(`drive:${f.id}`));

if (already.size > 0) {
  console.log(`→ ${already.size} fichier(s) déjà importé(s), ignoré(s)`);
}
console.log(`→ ${todo.length} à importer — stockage : ${storageMode()}`);

if (flags.dryRun) {
  for (const f of todo) console.log(`  • ${f.name || "(nom inconnu)"}  [${f.id}]`);
  console.log("\n(dry-run — rien n'a été importé)");
  process.exit(0);
}

// --- import ---------------------------------------------------------------
let ok = 0;
let failed = 0;

for (const f of todo) {
  const label = f.name || f.id;
  console.log(`\n• ${label}`);
  let tmpPath = null;

  try {
    const { path, ext } = await downloadToTmp(resolveDownloadUrl(fileUrl(f.id)), {
      hintName: f.name ?? "",
    });
    tmpPath = path;
    console.log(`  téléchargé (${ext}, ${isVideoExt(ext) ? "vidéo" : "image"})`);

    const id = nanoid(10);
    const media = await processMedia(path, id, ext);

    await insertItem({
      id,
      title: f.title ?? titleFromName(f.name ?? ""),
      description: null,
      tags: f.tags ?? flags.tags,
      category: f.category ?? flags.category,
      creator: f.creator ?? flags.creator,
      // The Drive link is private: it goes in import_key (technical, never
      // rendered), not in source_url (shown publicly on the item page).
      sourceUrl: null,
      importKey: `drive:${f.id}`,
      ...media,
    });

    console.log(`  ✓ publié — item ${id}`);
    ok++;
  } catch (err) {
    failed++;
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (tmpPath) await unlink(tmpPath).catch(() => {});
  }
}

console.log(`\n✓ terminé — ${ok} publié(s), ${failed} en erreur`);
process.exit(failed > 0 && ok === 0 ? 1 : 0);
