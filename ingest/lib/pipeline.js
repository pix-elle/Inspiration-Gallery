// The shared middle of every importer: compress one file, upload the
// variants, and hand back the media columns of its row. The back-office
// runner, the CLI and the bulk importers all funnel through here, so a change
// to the specs (formats, widths, poster frame) lands everywhere at once.
import { unlink } from "node:fs/promises";
import { heifToPng } from "./heif.js";
import { processImage } from "./image.js";
import { processVideo } from "./video.js";
import { dominantColor, blurDataUrl } from "./placeholder.js";

export const VIDEO_EXT = new Set([".mov", ".mp4", ".webm", ".m4v"]);
export const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif"]);
export const MEDIA_EXT = new Set([...VIDEO_EXT, ...IMAGE_EXT]);

// iPhones photograph in HEIC by default; the decoding and the orientation
// fix both live in heif.js, which documents why each is needed.
const HEIF_EXT = new Set([".heic", ".heif"]);

export function isVideoExt(ext) {
  return VIDEO_EXT.has(ext.toLowerCase());
}

// Returns { type, width, height, dominantColor, blurDataUrl, posterUrl,
//           imageBase, videoUrl, videoAv1Url } — ready to spread into insertItem().
export async function processMedia(inputPath, id, ext) {
  if (isVideoExt(ext)) {
    const v = await processVideo(inputPath, id);
    return {
      type: "video",
      width: v.width,
      height: v.height,
      // Colors come from the poster frame — the video itself isn't an image.
      dominantColor: await dominantColor(v.posterPng),
      blurDataUrl: await blurDataUrl(v.posterPng),
      posterUrl: v.posterUrl,
      videoUrl: v.videoUrl,
      imageBase: null,
      videoAv1Url: null,
    };
  }

  // A HEIC is decoded to PNG first; every measurement below then runs on the
  // decoded file, never on the original sharp can't open.
  const isHeif = HEIF_EXT.has(ext.toLowerCase());
  const source = isHeif ? await heifToPng(inputPath, id) : inputPath;

  try {
    const img = await processImage(source, id);
    return {
      type: "image",
      width: img.width,
      height: img.height,
      dominantColor: await dominantColor(source),
      blurDataUrl: await blurDataUrl(source),
      imageBase: img.imageBase,
      posterUrl: null,
      videoUrl: null,
      videoAv1Url: null,
    };
  } finally {
    if (isHeif) await unlink(source).catch(() => {});
  }
}
