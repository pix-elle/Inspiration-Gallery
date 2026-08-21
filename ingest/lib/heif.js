import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

// iPhones photograph in HEIC by default — 175 of the files in Alessia's Drive.
// sharp reads their metadata but cannot decode the pixels: its prebuilt binary
// ships libheif without the HEVC decoder, for licensing reasons. ffmpeg has
// one, so a HEIC becomes a PNG and the ordinary image path takes over.
//
// Two traps, both measured rather than assumed:
//
//  1. These files hold several images (a full-size one plus thumbnails), so
//     ffmpeg treats the output as a sequence and refuses a fixed filename —
//     while still writing the frame. `-update 1` says "one image, one file".
//
//  2. Nobody applies the EXIF rotation. macOS reports 4032x3024 where both
//     ffmpeg and sharp report 3024x4032, because the orientation tag lives in
//     EXIF and the decoded PNG carries none. Left alone, every portrait photo
//     would land sideways in the gallery.

// Applies to a sharp pipeline what the EXIF orientation asks for.
const TRANSFORMS = {
  2: (s) => s.flop(),
  3: (s) => s.rotate(180),
  4: (s) => s.flip(),
  5: (s) => s.rotate(90).flop(),
  6: (s) => s.rotate(90),
  7: (s) => s.rotate(270).flop(),
  8: (s) => s.rotate(270),
};

// Walks the raw EXIF block for tag 0x0112. sharp exposes the bytes but not the
// parsed value on a HEIC, so we read it ourselves.
export function readExifOrientation(exif) {
  if (!exif || exif.length < 20) return 1;
  const littleEndian = exif.toString("ascii", 6, 8) === "II";
  const limit = Math.min(exif.length - 12, 8192);
  for (let i = 8; i < limit; i++) {
    const tag = littleEndian ? exif.readUInt16LE(i) : exif.readUInt16BE(i);
    if (tag !== 0x0112) continue;
    const value = littleEndian
      ? exif.readUInt16LE(i + 8)
      : exif.readUInt16BE(i + 8);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return 1;
}

// Returns the path of a decoded, correctly-oriented PNG. The caller owns it
// and must delete it.
export async function heifToPng(inputPath, id) {
  const decoded = join(tmpdir(), `heif-${id}-raw.png`);
  await run("ffmpeg", [
    "-v", "error",
    "-i", inputPath,
    "-frames:v", "1",
    "-update", "1",
    "-y", decoded,
  ]);

  const { exif } = await sharp(inputPath).metadata();
  const orientation = readExifOrientation(exif);
  if (orientation === 1) return decoded;

  const rotated = join(tmpdir(), `heif-${id}.png`);
  await TRANSFORMS[orientation](sharp(decoded)).toFile(rotated);
  await unlink(decoded).catch(() => {});
  return rotated;
}
