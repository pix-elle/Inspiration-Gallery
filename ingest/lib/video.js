import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { storeBuffer } from "./storage.js";

const run = promisify(execFile);

async function probe(inputPath) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,duration",
    "-of", "csv=p=0",
    inputPath,
  ]);
  const [width, height, duration] = stdout.trim().split(",");
  return { width: Number(width), height: Number(height), duration: Number(duration) || 0 };
}

export async function processVideo(inputPath, id) {
  const { width, height, duration } = await probe(inputPath);

  // Compressed, muted, faststart MP4 — specs from docs/02.
  const mp4Path = join(tmpdir(), `ingest-${id}.mp4`);
  await run("ffmpeg", [
    "-i", inputPath,
    "-vf", "scale='min(1920,iw)':-2",
    "-c:v", "libx264", "-profile:v", "high", "-crf", "26", "-preset", "slow",
    "-movflags", "+faststart",
    "-an",
    "-y", mp4Path,
  ]);
  const mp4 = await readFile(mp4Path);
  const videoUrl = await storeBuffer(mp4, `items/${id}/video.mp4`);
  console.log(`  video: ${(mp4.length / 1024 / 1024).toFixed(2)}MB (${duration.toFixed(1)}s)`);

  // Poster frame at 1s (or 0s for very short clips) → AVIF.
  const posterPng = join(tmpdir(), `ingest-${id}-poster.png`);
  await run("ffmpeg", [
    "-i", mp4Path,
    "-ss", duration >= 2 ? "00:00:01" : "00:00:00",
    "-frames:v", "1",
    "-y", posterPng,
  ]);
  const posterAvif = await sharp(posterPng).resize(1200, null, { withoutEnlargement: true }).avif({ quality: 55 }).toBuffer();
  const posterUrl = await storeBuffer(posterAvif, `items/${id}/poster.avif`);

  return { videoUrl, posterUrl, posterPng, width, height };
}
