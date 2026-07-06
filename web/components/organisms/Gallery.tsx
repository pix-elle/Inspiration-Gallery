"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VirtuosoMasonry } from "@virtuoso.dev/masonry";
import type { Item, ItemsPage } from "@/lib/types";
import { GalleryItem } from "./GalleryItem";
import { Spinner } from "@/components/atoms/Spinner";

// VirtuosoMasonry takes a plain number, so column count is derived from
// viewport width: 2 (mobile) / 3 (tablet+laptop) / 4 (wide).
function useColumnCount() {
  const [columns, setColumns] = useState(3);
  useEffect(() => {
    const compute = () =>
      setColumns(window.innerWidth < 640 ? 2 : window.innerWidth < 1280 ? 3 : 4);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return columns;
}

const ItemContent = ({ data }: { data: Item }) => <GalleryItem item={data} />;

type GalleryProps = {
  initialItems: Item[];
  initialCursor: string | null;
};

export function Gallery({ initialItems, initialCursor }: GalleryProps) {
  const columnCount = useColumnCount();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/items?cursor=${encodeURIComponent(cursor)}`);
      const page: ItemsPage = await res.json();
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor]);

  // The masonry lib has no endReached — a sentinel under the grid triggers
  // the next page as it approaches the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { rootMargin: "800px" } // prefetch well before the user hits the bottom
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="-mx-2">
      <VirtuosoMasonry
        useWindowScroll
        columnCount={columnCount}
        data={items}
        initialItemCount={items.length}
        ItemContent={ItemContent}
      />
      <div ref={sentinelRef} className="flex h-16 items-center justify-center">
        {loading && <Spinner />}
      </div>
    </div>
  );
}
