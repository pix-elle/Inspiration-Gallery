#!/usr/bin/env node
import { Command } from "commander";
import { nanoid } from "nanoid";
import { extname, basename } from "node:path";
import { processImage } from "./lib/image.js";
import { processVideo } from "./lib/video.js";
import { dominantColor, blurDataUrl } from "./lib/placeholder.js";
import { insertItem } from "./lib/db.js";
import { storageMode } from "./lib/storage.js";

const VIDEO_EXT = new Set([".mov", ".mp4", ".webm", ".m4v"]);

const program = new Command();
program
  .name("ingest")
  .argument("<file>", "path to the source image or video")
  .option("--title <title>", "item title")
  .option("--description <desc>", "description")
  .option("--tags <tags>", "comma-separated tags", (v) => v.split(",").map((t) => t.trim()))
  .option("--category <cat>", "category")
  .option("--creator <name>", "who made it")
  .option("--source <url>", "original inspiration link")
  .parse();

const file = program.args[0];
const opts = program.opts();
const id = nanoid(10);
const isVideo = VIDEO_EXT.has(extname(file).toLowerCase());

console.log(`→ ingesting ${isVideo ? "video" : "image"} "${basename(file)}" as ${id}`);
console.log(`  storage: ${storageMode()}`);

let media;
if (isVideo) {
  const v = await processVideo(file, id);
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
  const img = await processImage(file, id);
  media = {
    type: "image",
    width: img.width,
    height: img.height,
    dominantColor: await dominantColor(file),
    blurDataUrl: await blurDataUrl(file),
    imageBase: img.imageBase,
    posterUrl: null,
    videoUrl: null,
    videoAv1Url: null,
  };
}

await insertItem({
  id,
  title: opts.title ?? null,
  description: opts.description ?? null,
  tags: opts.tags ?? [],
  category: opts.category ?? null,
  creator: opts.creator ?? null,
  sourceUrl: opts.source ?? null,
  ...media,
});

console.log(`✓ done — item ${id} (${media.width}x${media.height}, ${media.dominantColor})`);
process.exit(0);
