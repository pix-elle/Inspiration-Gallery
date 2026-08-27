"use client";

import { useState } from "react";
import type { Item } from "@/lib/types";

const ALL_WIDTHS = [400, 800, 1200, 2000];
// Approximation des seuils de useColumnCount. « Approximation » parce que
// sizes s'exprime en unités de fenêtre et ne peut pas savoir si la barre
// latérale est repliée — la même fenêtre donne deux largeurs de tuile. On
// arrondit vers le haut : sur-estimer coûte quelques octets, sous-estimer
// rendrait l'image floue, ce qui ne se rattrape pas.
const SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

export function ImageTile({ item }: { item: Item }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

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
        <source type="image/avif" srcSet={srcset("avif")} sizes={SIZES} />
        <source type="image/webp" srcSet={srcset("webp")} sizes={SIZES} />
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
