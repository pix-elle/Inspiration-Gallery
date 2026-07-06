import sharp from "sharp";
import { storeBuffer } from "./storage.js";
import { CDN_BASE_URL } from "./env.js";

const WIDTHS = [400, 800, 1200, 2000];

// One original in → AVIF + WebP at each width. The frontend builds
// `${image_base}/${width}.${format}` srcsets from image_base.
export async function processImage(inputPath, id) {
  const meta = await sharp(inputPath).metadata();
  const generated = [];

  for (const w of WIDTHS) {
    if (meta.width && w > meta.width) continue; // never upscale

    const avif = await sharp(inputPath).resize(w).avif({ quality: 50 }).toBuffer();
    await storeBuffer(avif, `items/${id}/${w}.avif`);

    const webp = await sharp(inputPath).resize(w).webp({ quality: 75 }).toBuffer();
    await storeBuffer(webp, `items/${id}/${w}.webp`);

    generated.push(`${w} (avif ${(avif.length / 1024).toFixed(0)}KB, webp ${(webp.length / 1024).toFixed(0)}KB)`);
  }

  // Guarantee at least one variant for small originals.
  if (generated.length === 0) {
    const w = meta.width ?? 400;
    const avif = await sharp(inputPath).avif({ quality: 50 }).toBuffer();
    await storeBuffer(avif, `items/${id}/${w}.avif`);
    const webp = await sharp(inputPath).webp({ quality: 75 }).toBuffer();
    await storeBuffer(webp, `items/${id}/${w}.webp`);
    generated.push(`${w} (original size)`);
  }

  console.log(`  image variants: ${generated.join(", ")}`);
  return {
    imageBase: `${CDN_BASE_URL}/items/${id}`,
    width: meta.width,
    height: meta.height,
  };
}
