import sharp from "sharp";
import { storeBuffer } from "./storage.js";
import { CDN_BASE_URL } from "./env.js";

const WIDTHS = [400, 800, 1200, 2000];

// One original in → AVIF + WebP at each width. The frontend builds
// `${image_base}/${width}.${format}` srcsets from image_base.
//
// .rotate() with no argument applies the EXIF orientation. It is not
// optional: phones store a portrait photo as a landscape frame plus a "turn
// this" flag, and sharp strips metadata on output. Without it the variants
// keep the raw pixels, lose the flag that explained them, and every portrait
// photo lands sideways in the gallery — 183 of the 262 images in Alessia's
// archive carry that flag.
export async function processImage(inputPath, id) {
  const meta = await sharp(inputPath).metadata();
  // Orientations 5 to 8 are the quarter-turns: displayed width and height are
  // the stored ones, swapped. The gallery reserves each tile from these
  // numbers, so getting them wrong tilts the whole grid.
  const turned = (meta.orientation ?? 1) >= 5;
  const width = turned ? meta.height : meta.width;
  const height = turned ? meta.width : meta.height;
  const generated = [];

  for (const w of WIDTHS) {
    if (width && w > width) continue; // never upscale

    const avif = await sharp(inputPath).rotate().resize(w).avif({ quality: 50 }).toBuffer();
    await storeBuffer(avif, `items/${id}/${w}.avif`);

    const webp = await sharp(inputPath).rotate().resize(w).webp({ quality: 75 }).toBuffer();
    await storeBuffer(webp, `items/${id}/${w}.webp`);

    generated.push(`${w} (avif ${(avif.length / 1024).toFixed(0)}KB, webp ${(webp.length / 1024).toFixed(0)}KB)`);
  }

  // Guarantee at least one variant for small originals.
  if (generated.length === 0) {
    const w = width ?? 400;
    const avif = await sharp(inputPath).rotate().avif({ quality: 50 }).toBuffer();
    await storeBuffer(avif, `items/${id}/${w}.avif`);
    const webp = await sharp(inputPath).rotate().webp({ quality: 75 }).toBuffer();
    await storeBuffer(webp, `items/${id}/${w}.webp`);
    generated.push(`${w} (original size)`);
  }

  console.log(`  image variants: ${generated.join(", ")}`);
  return { imageBase: `${CDN_BASE_URL}/items/${id}`, width, height };
}
