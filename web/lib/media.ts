// Largest variant the ingest CLI actually generated (it never upscales;
// if no standard width fits, it emitted one at the original width).
const VARIANT_WIDTHS = [2000, 1200, 800, 400];

export function bestWidth(itemWidth: number): number {
  return VARIANT_WIDTHS.find((w) => w <= itemWidth) ?? itemWidth;
}

// Format imposé à toutes les tuiles de la grille (voir GalleryItem).
export const TILE_ASPECT = 9 / 16;

// object-cover agrandit l'image jusqu'à couvrir le cadre : une photo plus
// large que la tuile est mise à l'échelle sur la HAUTEUR, et se retrouve
// rendue bien plus large que la tuile elle-même — une 4:3 occupe 2,37 fois la
// largeur avant d'être rognée. Sans ce facteur, `sizes` ferait choisir au
// navigateur une variante calibrée sur la largeur de la tuile, et toutes les
// photos en paysage sortiraient floues.
export function coverScale(width: number, height: number): number {
  const ratio = width / height;
  return ratio > TILE_ASPECT ? ratio / TILE_ASPECT : 1;
}
