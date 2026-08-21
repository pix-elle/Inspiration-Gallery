#!/usr/bin/env node
// Encode one item uploaded from the back-office.
//
// The portal writes a row with status "processing" and the key of the
// original it just put on R2, then wakes this runner. ffmpeg can't run on
// Vercel; here it can, and the pipeline is the very same one the bulk
// importers use — HDR conversion and rotation fix included.
//
// Usage:  node worker/process-item.js <item-id>
// En CI:  .github/workflows/transcode.yml (workflow_dispatch)

import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { env, useR2 } from "../lib/env.js";
import { processMedia } from "../lib/pipeline.js";
import { fetchObject, storageMode } from "../lib/storage.js";
import {
  getItemForProcessing,
  publishProcessedItem,
  failItem,
} from "../lib/db.js";

const id = process.argv[2];
if (!id) {
  console.error("Usage : node worker/process-item.js <item-id>");
  process.exit(1);
}
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}
if (!useR2) {
  console.error("Stockage R2 requis (secrets S3_* absents)");
  process.exit(1);
}

const item = await getItemForProcessing(id);
if (!item) {
  console.error(`Item ${id} introuvable en base`);
  process.exit(1);
}
if (!item.source_key) {
  await failItem(id, "Aucun fichier source associé à cet item");
  console.error(`Item ${id} sans source_key`);
  process.exit(1);
}

console.log(`→ encodage de ${id} (${item.source_key}) — stockage : ${storageMode()}`);

let tmpPath = null;
try {
  // Down from R2, onto the runner's disk: ffmpeg needs a real file, and
  // ffprobe has to seek freely through it.
  const buffer = await fetchObject(item.source_key);
  const ext = extname(item.source_key).toLowerCase();
  tmpPath = join(tmpdir(), `item-${id}${ext}`);
  await writeFile(tmpPath, buffer);
  console.log(`  source récupérée (${(buffer.length / 1e6).toFixed(1)} Mo, ${ext})`);

  const media = await processMedia(tmpPath, id, ext);
  await publishProcessedItem(id, media);

  console.log(`  ✓ publié — ${media.width}x${media.height}, ${media.dominantColor}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`  ✗ ${message}`);
  // The row carries its own failure: the table shows why, and Alessia can
  // retry or delete without anyone reading a CI log.
  await failItem(id, message).catch(() => {});
  process.exit(1);
} finally {
  if (tmpPath) await unlink(tmpPath).catch(() => {});
}
