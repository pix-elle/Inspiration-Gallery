"use client";

import { useState } from "react";
import { coverScale } from "@/lib/media";
import type { Item } from "@/lib/types";

const ALL_WIDTHS = [400, 800, 1200, 2000];
// Part de la fenêtre occupée par une tuile, avant recadrage. Approximation
// des seuils de useColumnCount : sizes s'exprime en unités de fenêtre et ne
// peut pas savoir si la barre latérale est repliée — la même fenêtre donne
// deux largeurs de tuile. On arrondit vers le haut : sur-estimer coûte
// quelques octets, sous-estimer rendrait l'image floue, ce qui ne se rattrape
// pas.
const BASE_VW: [maxWidth: number | null, vw: number][] = [
  [640, 100],
  [1024, 50],
  [null, 33],
];

// Multiplié par l'agrandissement qu'impose le recadrage 9:16, sinon le
// navigateur choisirait une variante calibrée sur la largeur de la tuile
// pour une image rendue deux fois plus large.
function sizesFor(scale: number): string {
  return BASE_VW.map(([max, vw]) => {
    const value = `${Math.ceil(vw * scale)}vw`;
    return max ? `(max-width: ${max}px) ${value}` : value;
  }).join(", ");
}

export function ImageTile({ item }: { item: Item }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const sizes = sizesFor(coverScale(item.width, item.height));

  // The ingest CLI never upscales, so only widths <= the original exist.
  const widths = ALL_WIDTHS.filter((w) => w <= item.width);
  if (widths.length === 0) widths.push(item.width);

  const srcset = (fmt: string) =>
    widths.map((w) => `${item.image_base}/${w}.${fmt} ${w}w`).join(", ");
  const fallbackWidth = widths[Math.min(1, widths.length - 1)];

  // Legacy/broken media: keep showing the dominant-color block.
  if (failed) return null;

  return (
    <div className="relative h-full w-full">
      {item.blur_data_url && (
        <img
          src={item.blur_data_url}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      <picture>
        <source type="image/avif" srcSet={srcset("avif")} sizes={sizes} />
        <source type="image/webp" srcSet={srcset("webp")} sizes={sizes} />
        <img
          src={`${item.image_base}/${fallbackWidth}.webp`}
          alt={item.title ?? ""}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </picture>
    </div>
  );
}
