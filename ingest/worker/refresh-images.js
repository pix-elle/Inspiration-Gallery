#!/usr/bin/env node
// Regenerates the image variants of already-published items.
//
// Written for a specific bug: processImage never applied the EXIF orientation,
// so every photo a phone stored as "landscape frame + turn this flag" was
// published sideways, with a tile reserved in the wrong shape. 183 of the 262
// images in the archive carry that flag.
//
// Only touches what needs it: an item is refreshed when the local file that
// produced it declares a quarter-turn. Videos are untouched — their
// dimensions have come from the encoded output since the rotation fix there.
//
// Usage:  node worker/refresh-images.js <dossier des sources> [--dry-run]

import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import sharp from "sharp";
import { env, useR2 } from "../lib/env.js";
import { IMAGE_EXT } from "../lib/pipeline.js";
import { processImage } from "../lib/image.js";
import { dominantColor, blurDataUrl } from "../lib/placeholder.js";
import { itemByImportKey, updateItemImage } from "../lib/db.js";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const roots = argv.filter((a) => !a.startsWith("--"));

if (roots.length === 0) {
  console.error("Usage : node worker/refresh-images.js <dossier> [--dry-run]");
  process.exit(1);
}
if (!dryRun && !useR2) {
  console.error("Stockage R2 requis");
  process.exit(1);
}
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (IMAGE_EXT.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

const files = [];
for (const root of roots) await walk(root, files);
console.log(`→ ${files.length} image(s) sur le disque`);

// HEIC went through heif.js, which already applied the rotation, so only the
// files sharp reads directly are suspect.
const suspects = [];
for (const file of files) {
  if ([".heic", ".heif"].includes(extname(file).toLowerCase())) continue;
  try {
    const { orientation } = await sharp(file).metadata();
    if ((orientation ?? 1) >= 5) suspects.push(file);
  } catch {
    // Illisible ici : elle n'a pas pu être importée non plus.
  }
}
console.log(`→ ${suspects.length} déclarent un quart de tour`);

if (dryRun) {
  for (const f of suspects.slice(0, 10)) console.log(`  • ${f.split("/").pop()}`);
  if (suspects.length > 10) console.log(`  … et ${suspects.length - 10} autres`);
  console.log("\n(dry-run — rien n'a été régénéré)");
  process.exit(0);
}

let fixed = 0;
let absent = 0;
let failed = 0;

for (const [i, file] of suspects.entries()) {
  const name = file.split("/").pop();
  const item = await itemByImportKey(`sha256:${await sha256(file)}`);
  if (!item) {
    absent++;
    continue;
  }

  try {
    // Same id, so the variants overwrite the wrong ones in place — no orphan
    // files, and no change to any URL already in the database.
    const img = await processImage(file, item.id);
    await updateItemImage(item.id, {
      width: img.width,
      height: img.height,
      dominantColor: await dominantColor(file),
      blurDataUrl: await blurDataUrl(file),
    });
    fixed++;
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${suspects.length}…`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name} — ${err instanceof Error ? err.message : err}`);
  }
}

console.log(
  `✓ ${fixed} image(s) régénérée(s), ${absent} sans ligne correspondante, ${failed} en erreur`
);
