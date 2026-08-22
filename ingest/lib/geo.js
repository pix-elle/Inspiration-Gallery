import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

// Where a photo or a clip was shot is already in the file — 98% of the images
// in Alessia's archive carry GPS coordinates, and most of the .MOV files do
// too. Reading them turns "location" from a field somebody has to fill in 400
// times into one that is populated on import.
//
// The two formats have nothing in common:
//  - images store it in the EXIF GPS IFD, as degrees/minutes/seconds rationals
//  - Apple videos store an ISO 6709 string in a QuickTime tag

// --- images ---------------------------------------------------------------

// Minimal EXIF walk. A dependency would parse every tag; we need exactly four.
function readExifGps(exif) {
  if (!exif || exif.length < 20) return null;
  const le = exif.toString("ascii", 6, 8) === "II";
  const u16 = (o) => (le ? exif.readUInt16LE(o) : exif.readUInt16BE(o));
  const u32 = (o) => (le ? exif.readUInt32LE(o) : exif.readUInt32BE(o));

  // TIFF header starts at byte 6 ("Exif\0\0" prefix); all offsets are relative
  // to it, which is the detail that makes hand-parsing EXIF go wrong.
  const tiff = 6;
  let gpsIfd = null;

  const ifd0 = tiff + u32(tiff + 4);
  const count0 = u16(ifd0);
  for (let i = 0; i < count0; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (u16(entry) === 0x8825) gpsIfd = tiff + u32(entry + 8);
  }
  if (gpsIfd === null || gpsIfd + 2 > exif.length) return null;

  const tags = new Map();
  const count = u16(gpsIfd);
  for (let i = 0; i < count; i++) {
    const entry = gpsIfd + 2 + i * 12;
    if (entry + 12 > exif.length) break;
    tags.set(u16(entry), {
      type: u16(entry + 2),
      count: u32(entry + 4),
      valueOffset: entry + 8,
    });
  }

  // ASCII refs (N/S/E/W) fit in the four value bytes, so they sit inline.
  const ref = (tag) => {
    const t = tags.get(tag);
    return t ? String.fromCharCode(exif[t.valueOffset]) : null;
  };

  // Degrees/minutes/seconds, three rationals of 8 bytes each, stored out of
  // line because 24 bytes never fit in the entry.
  const dms = (tag) => {
    const t = tags.get(tag);
    if (!t || t.count < 3) return null;
    const at = tiff + u32(t.valueOffset);
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const num = u32(at + i * 8);
      const den = u32(at + i * 8 + 4);
      if (!den) return null;
      parts.push(num / den);
    }
    return parts[0] + parts[1] / 60 + parts[2] / 3600;
  };

  const lat = dms(2);
  const lon = dms(4);
  if (lat === null || lon === null) return null;

  return {
    latitude: ref(1) === "S" ? -lat : lat,
    longitude: ref(3) === "W" ? -lon : lon,
  };
}

// --- vidéos ---------------------------------------------------------------

// "+13.7263+100.5098+003.902/" — signed decimal degrees, altitude optional.
export function parseIso6709(value) {
  const m = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(value.trim());
  if (!m) return null;
  return { latitude: Number(m[1]), longitude: Number(m[2]) };
}

async function readVideoLocation(path) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries",
    "format_tags=location,com.apple.quicktime.location.ISO6709",
    "-of", "default=nw=1:nk=1",
    path,
  ]);
  for (const line of stdout.split("\n")) {
    const parsed = line.trim() && parseIso6709(line);
    if (parsed) return parsed;
  }
  return null;
}

// --- entrée unique --------------------------------------------------------

const VIDEO = /\.(mov|mp4|m4v|webm)$/i;

// Never throws: a missing location is normal, and must not fail an import.
export async function readLocation(path) {
  try {
    if (VIDEO.test(path)) return await readVideoLocation(path);
    const { exif } = await sharp(path).metadata();
    return readExifGps(exif);
  } catch {
    return null;
  }
}
