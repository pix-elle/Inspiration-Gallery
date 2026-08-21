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
  // Dimensions come from the *output* further down, never from here: phones
  // record portrait clips as 1920x1080 plus a rotation flag, ffmpeg applies
  // the rotation when transcoding, and the gallery would otherwise reserve a
  // landscape tile for a portrait video.
  const { duration } = await probe(inputPath);

  // Compressed, muted, faststart MP4 — specs from docs/02.
  //
  // format=yuv420p is not cosmetic: iPhone films in HDR by default
  // (yuv420p10le, HLG transfer) and libx264's High profile is 8-bit only —
  // without the conversion, ffmpeg dies with "Could not open encoder".
  // A straight conversion is also the *right* one here: HLG was designed to
  // degrade gracefully on SDR screens, so the picture stays vivid. Feeding
  // HLG values to the tonemap filter without linearising them (this build
  // has no zscale) crushes the image instead — measured, not assumed.
  const mp4Path = join(tmpdir(), `ingest-${id}.mp4`);
  await run("ffmpeg", [
    "-i", inputPath,
    "-vf", "scale='min(1920,iw)':-2,format=yuv420p",
    "-c:v", "libx264", "-profile:v", "high", "-crf", "26", "-preset", "slow",
    "-movflags", "+faststart",
    "-an",
    "-y", mp4Path,
  ]);
  const { width, height } = await probe(mp4Path);
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
