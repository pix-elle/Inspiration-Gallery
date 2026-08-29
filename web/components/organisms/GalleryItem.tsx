"use client";

import type { Item } from "@/lib/types";
import { ImageTile } from "@/components/molecules/ImageTile";
import { VideoTile } from "@/components/molecules/VideoTile";

type GalleryItemProps = {
  item: Item;
  onOpen: (item: Item) => void;
  // "none" except on the tile being opened/closed — named elements are
  // snapshotted above the whole page during a transition, so only the
  // morphing tile may carry a name (and it must be unique vs the modal's).
  transitionName: string;
};

// Toutes les tuiles de la grille adoptent le même format vertical, quel que
// soit le cadrage d'origine du média. Le recadrage est fait à l'affichage
// (object-cover dans ImageTile et VideoTile) et non sur les fichiers : les
// variantes stockées sur R2 restent intactes, et la lightbox continue
// d'afficher la photo entière puisqu'elle lit le ratio réel de l'item.
// Repasser à la mosaïque d'origine = remettre `item.width / item.height`.
const TILE_ASPECT = 9 / 16;

// Dominant color is reserved before any media loads, so tiles never shift
// the layout. Clicking opens the in-memory lightbox (instant morph); the
// href is kept for middle-click, share and SEO.
export function GalleryItem({ item, onOpen, transitionName }: GalleryItemProps) {
  return (
    <a
      href={`/item/${item.id}`}
      aria-label={item.title ?? `View ${item.type}`}
      className="gallery-tile block px-2 pb-4"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpen(item);
      }}
    >
      <div
        className="overflow-hidden rounded-lg"
        style={{
          aspectRatio: TILE_ASPECT,
          backgroundColor: item.dominant_color ?? "#1a1a1a",
          viewTransitionName: transitionName,
        }}
      >
        {item.type === "video" ? (
          <VideoTile item={item} />
        ) : (
          <ImageTile item={item} />
        )}
      </div>
    </a>
  );
}
