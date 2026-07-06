"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item, ItemsPage } from "@/lib/types";
import { distribute } from "@/lib/masonry";
import { GalleryItem } from "./GalleryItem";
import { Spinner } from "@/components/atoms/Spinner";

// Column count: 2 (mobile) / 3 (tablet+laptop) / 4 (wide).
// SSR default is 4 (desktop-first) so the first paint doesn't reflow on
// desktop; smaller screens correct once on mount.
function useColumnCount() {
  const [columns, setColumns] = useState(4);
  useEffect(() => {
    const compute = () =>
      setColumns(window.innerWidth < 640 ? 2 : window.innerWidth < 1280 ? 3 : 4);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return columns;
}

type GalleryProps = {
  initialItems: Item[];
  initialCursor: string | null;
  type?: "image" | "video";
  tag?: string;
};

export function Gallery({ initialItems, initialCursor, type, tag }: GalleryProps) {
  const columnCount = useColumnCount();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Server and client run the same deterministic distribution, so SSR HTML
  // matches hydration exactly — no layout shift. Appending pages re-runs it
  // with the same prefix, so existing tiles keep their positions.
  const columns = useMemo(
    () => distribute(items, columnCount),
    [items, columnCount]
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ cursor });
      if (type) params.set("type", type);
      if (tag) params.set("tag", tag);
      const res = await fetch(`/api/items?${params}`);
      const page: ItemsPage = await res.json();
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, type, tag]);

  // Sentinel under the grid triggers the next page before the user reaches it.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { rootMargin: "800px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  if (items.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Nothing here yet</p>
        <p className="text-sm text-foreground/60">
          New inspiration is added regularly — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-2">
      <div className="flex items-start">
        {columns.map((column, c) => (
          <div key={c} className="min-w-0 flex-1">
            {column.map((item) => (
              <GalleryItem key={item.id} item={item} />
            ))}
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="flex h-16 items-center justify-center">
        {loading && <Spinner />}
      </div>
    </div>
  );
}
