"use client";

import Link from "next/link";
import type { Item } from "@/lib/types";
import { ImageTile } from "@/components/molecules/ImageTile";
import { VideoTile } from "@/components/molecules/VideoTile";

// Aspect ratio + dominant color are reserved before any media loads,
// so tiles never shift the layout.
export function GalleryItem({ item }: { item: Item }) {
  return (
    <Link
      href={`/item/${item.id}`}
      aria-label={item.title ?? `View ${item.type}`}
      className="block px-2 pb-4"
    >
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
    </Link>
  );
}
