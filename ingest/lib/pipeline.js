// The shared middle of every importer: compress one file, upload the
// variants, and hand back the media columns of its row. The CLI and the
// Notion / Drive / local-folder workers all funnel through here so a change
// to the specs (formats, widths, poster frame) lands everywhere at once.
import { processImage } from "./image.js";
import { processVideo } from "./video.js";
import { dominantColor, blurDataUrl } from "./placeholder.js";

export const VIDEO_EXT = new Set([".mov", ".mp4", ".webm", ".m4v"]);
export const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const MEDIA_EXT = new Set([...VIDEO_EXT, ...IMAGE_EXT]);

export function isVideoExt(ext) {
  return VIDEO_EXT.has(ext.toLowerCase());
}

// Returns { type, width, height, dominantColor, blurDataUrl, posterUrl,
//           imageBase, videoUrl, videoAv1Url } — ready to spread into insertItem().
export async function processMedia(path, id, ext) {
  if (isVideoExt(ext)) {
    const v = await processVideo(path, id);
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

  const img = await processImage(path, id);
  return {
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
