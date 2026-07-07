// Largest variant the ingest CLI actually generated (it never upscales;
// if no standard width fits, it emitted one at the original width).
const VARIANT_WIDTHS = [2000, 1200, 800, 400];

export function bestWidth(itemWidth: number): number {
  return VARIANT_WIDTHS.find((w) => w <= itemWidth) ?? itemWidth;
}
