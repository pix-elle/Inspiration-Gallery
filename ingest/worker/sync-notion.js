#!/usr/bin/env node
// Notion → gallery ingestion worker.
// Reads rows marked "Prêt à publier" from the Notion inbox, downloads the
// media (attachment / Dropbox / Google Drive), runs the exact same pipeline
// as the local CLI, then reports status back into the Notion row.
//
// Run locally:  node worker/sync-notion.js
// Runs in CI:   .github/workflows/notion-ingest.yml (cron)
//
// Required env: NOTION_TOKEN, NOTION_DATABASE_ID, DATABASE_URL
//               (+ S3_*/CDN_BASE_URL for R2 — mandatory in CI)

import { unlink } from "node:fs/promises";
import { nanoid } from "nanoid";
import { env, useR2 } from "../lib/env.js";
import { processImage } from "../lib/image.js";
import { processVideo } from "../lib/video.js";
import { dominantColor, blurDataUrl } from "../lib/placeholder.js";
import { insertItem } from "../lib/db.js";
import { storageMode } from "../lib/storage.js";
import { fetchQueue, setStatus } from "./notion.js";
import { resolveDownloadUrl, downloadToTmp } from "./download.js";

const VIDEO_EXT = new Set([".mov", ".mp4", ".webm"]);

if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
  console.error("NOTION_TOKEN / NOTION_DATABASE_ID manquants (ingest/.env)");
  process.exit(1);
}
if (process.env.CI && !useR2) {
  // Local storage mode writes into web/public/media — pointless on a CI
  // runner whose filesystem is discarded. R2 is required there.
  console.error("En CI, le stockage R2 est requis (secrets S3_* absents)");
  process.exit(1);
}

const queue = await fetchQueue();
console.log(`→ ${queue.length} item(s) à traiter — stockage : ${storageMode()}`);

let ok = 0;
let failed = 0;

for (const row of queue) {
  console.log(`\n• "${row.title ?? "(sans titre)"}" (${row.pageId})`);
  let tmpPath = null;

  try {
    await setStatus(row.pageId, "Traitement");

    // 1. Which source? Attachment first, else the share link.
    const sourceUrl = row.fileUrl ?? (row.linkUrl && resolveDownloadUrl(row.linkUrl));
    if (row.linkUrl && !row.fileUrl && !sourceUrl) {
      throw new Error("Lien non supporté — utilise Dropbox ou Google Drive");
    }
    if (!sourceUrl) {
      throw new Error("Aucun média — joins un fichier ou colle un lien Dropbox/Drive");
    }

    // 2. Download.
    const { path, ext } = await downloadToTmp(sourceUrl, {
      hintName: row.fileName ?? "",
    });
    tmpPath = path;
    const isVideo = VIDEO_EXT.has(ext);
    console.log(`  téléchargé (${ext}, ${isVideo ? "vidéo" : "image"})`);

    // 3. Same pipeline as the CLI.
    const id = nanoid(10);
    let media;
    if (isVideo) {
      const v = await processVideo(path, id);
      media = {
        type: "video",
        width: v.width,
        height: v.height,
        dominantColor: await dominantColor(v.posterPng),
        blurDataUrl: await blurDataUrl(v.posterPng),
        posterUrl: v.posterUrl,
        videoUrl: v.videoUrl,
        imageBase: null,
        videoAv1Url: null,
      };
    } else {
      const img = await processImage(path, id);
      media = {
        type: "image",
        width: img.width,
        height: img.height,
        dominantColor: await dominantColor(path),
        blurDataUrl: await blurDataUrl(path),
        imageBase: img.imageBase,
        posterUrl: null,
        videoUrl: null,
        videoAv1Url: null,
      };
    }

    await insertItem({
      id,
      title: row.title,
      description: row.description,
      tags: row.tags,
      category: row.category,
      creator: row.creator,
      sourceUrl: row.sourceUrl,
      ...media,
    });

    // 4. Report success back into the row.
    await setStatus(row.pageId, "✅ Publié", {
      itemId: id,
      publishedAt: new Date().toISOString().slice(0, 10),
      error: "",
    });
    console.log(`  ✓ publié — item ${id}`);
    ok++;
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${message}`);
    // Best effort — if even the status update fails, the row stays
    // "Traitement" and a human will spot it.
    try {
      await setStatus(row.pageId, "❌ Erreur", { error: message });
    } catch (statusErr) {
      console.error(`  (impossible de reporter l'erreur dans Notion: ${statusErr})`);
    }
  } finally {
    if (tmpPath) await unlink(tmpPath).catch(() => {});
  }
}

console.log(`\n✓ terminé — ${ok} publié(s), ${failed} en erreur`);
process.exit(failed > 0 && ok === 0 && queue.length > 0 ? 1 : 0);
