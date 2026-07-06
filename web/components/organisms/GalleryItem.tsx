"use client";

import type { Item } from "@/lib/types";
import { ImageTile } from "@/components/molecules/ImageTile";
import { VideoTile } from "@/components/molecules/VideoTile";

// Aspect ratio + dominant color are reserved before any media loads,
// so tiles never shift the layout. Becomes a link to /item/[id] in Phase 5.
export function GalleryItem({ item }: { item: Item }) {
  return (
    <div className="px-2 pb-4">
      <div
        className="overflow-hidden rounded-lg"
        style={{
          aspectRatio: item.width / item.height,
          backgroundColor: item.dominant_color ?? "#1a1a1a",
        }}
      >
        {item.type === "video" ? (
          <VideoTile item={item} />
        ) : (
          <ImageTile item={item} />
        )}
      </div>
    </div>
  );
}
