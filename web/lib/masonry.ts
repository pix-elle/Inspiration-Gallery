import type { Item } from "./types";

// Deterministic shortest-column-first distribution. Column widths are equal,
// so relative heights (1/aspect-ratio) are enough — no pixel measuring needed.
// Same input + column count → same layout on server and client, which is what
// makes SSR hydration shift-free.
export function distribute(items: Item[], columnCount: number): Item[][] {
  const columns: Item[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array(columnCount).fill(0);

  for (const item of items) {
    let shortest = 0;
    for (let c = 1; c < columnCount; c++) {
      if (heights[c] < heights[shortest]) shortest = c;
    }
    columns[shortest].push(item);
    heights[shortest] += item.height / item.width;
  }
  return columns;
}
