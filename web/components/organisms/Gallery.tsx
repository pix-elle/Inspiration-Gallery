"use client";

import { useEffect, useState } from "react";
import { VirtuosoMasonry } from "@virtuoso.dev/masonry";
import type { Item } from "@/lib/types";
import { GalleryItem } from "./GalleryItem";

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

export function Gallery({ initialItems }: { initialItems: Item[] }) {
  const columnCount = useColumnCount();

  return (
    <div className="-mx-2">
      <VirtuosoMasonry
        useWindowScroll
        columnCount={columnCount}
        data={initialItems}
        initialItemCount={initialItems.length}
        ItemContent={ItemContent}
      />
    </div>
  );
}
