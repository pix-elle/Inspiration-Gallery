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

// Aspect ratio + dominant color are reserved before any media loads,
// so tiles never shift the layout. Clicking opens the in-memory lightbox
// (instant morph); the href is kept for middle-click, share and SEO.
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
          aspectRatio: item.width / item.height,
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
