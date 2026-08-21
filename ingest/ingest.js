#!/usr/bin/env node
import { Command } from "commander";
import { nanoid } from "nanoid";
import { extname, basename } from "node:path";
import { processMedia, isVideoExt } from "./lib/pipeline.js";
import { insertItem } from "./lib/db.js";
import { storageMode } from "./lib/storage.js";

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
const ext = extname(file).toLowerCase();
const isVideo = isVideoExt(ext);

console.log(`→ ingesting ${isVideo ? "video" : "image"} "${basename(file)}" as ${id}`);
console.log(`  storage: ${storageMode()}`);

const media = await processMedia(file, id, ext);

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
