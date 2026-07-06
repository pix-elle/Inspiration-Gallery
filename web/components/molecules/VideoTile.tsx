"use client";

import type { Item } from "@/lib/types";
import { useInViewVideo } from "./useInViewVideo";

export function VideoTile({ item }: { item: Item }) {
  const ref = useInViewVideo(item.video_url!);

  return (
    <video
      ref={ref}
      poster={item.poster_url ?? undefined}
      muted
      loop
      playsInline
      preload="none" // nothing downloads until the tile is in view
      className="h-full w-full object-cover"
    />
  );
}
