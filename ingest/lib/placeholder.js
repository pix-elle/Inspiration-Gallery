import sharp from "sharp";

// Dominant color painted behind the tile before anything loads.
export async function dominantColor(input) {
  const { dominant } = await sharp(input).stats();
  const hex = (n) => n.toString(16).padStart(2, "0");
  return `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`;
}

// Tiny ~20px blurred base64 preview for the blur-up effect.
export async function blurDataUrl(input) {
  const buf = await sharp(input)
    .resize(20, 20, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}
