"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { GalleryFilters, Item, ItemsPage } from "@/lib/types";
import { distribute } from "@/lib/masonry";
import { bestWidth } from "@/lib/media";
import { GalleryItem } from "./GalleryItem";
import { ItemModal } from "./ItemModal";
import { Spinner } from "@/components/atoms/Spinner";

// Run a state update inside a native view transition when supported —
// the browser snapshots before/after and morphs matching
// view-transition-names. Falls back to an instant swap elsewhere.
function withViewTransition(update: () => void): ViewTransition | null {
  if (!document.startViewTransition) {
    update();
    return null;
  }
  const transition = document.startViewTransition(() => flushSync(update));
  // A skipped transition (rapid clicks, Esc mid-animation, hidden tab…)
  // still applies the state update — only the animation is dropped. The
  // browser rejects these promises; swallow them so they don't surface
  // as "Transition was skipped" console errors.
  transition.ready.catch(() => {});
  transition.finished.catch(() => {});
  return transition;
}

// Column count: 1 (mobile) / 3 partout ailleurs.
// SSR default is 3 (desktop-first) so the first paint doesn't reflow on
// desktop; smaller screens correct once on mount.
function useColumnCount() {
  const [columns, setColumns] = useState(3);
  useEffect(() => {
    const compute = () => setColumns(window.innerWidth < 640 ? 1 : 3);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return columns;
}

type GalleryProps = {
  initialItems: Item[];
  initialCursor: string | null;
  filters?: GalleryFilters;
};

export function Gallery({
  initialItems,
  initialCursor,
  filters = {},
}: GalleryProps) {
  const columnCount = useColumnCount();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Lightbox: opened from in-memory data so the morph starts on the same
  // frame as the click. The URL is kept shareable via history.pushState;
  // a direct load of /item/[id] gets the full server page instead.
  const [selected, setSelected] = useState<Item | null>(null);
  // Tenue à jour dans un effet, pas pendant le rendu : écrire une ref pendant
  // le rendu est ce que React interdit. Le gestionnaire popstate, lui, doit
  // lire la valeur courante sans se ré-abonner à chaque ouverture.
  const selectedRef = useRef<Item | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  // Only the clicked tile carries a view-transition-name: every named element
  // gets snapshotted ABOVE the real DOM (incl. the backdrop) during the
  // transition, so naming all tiles makes them float over the modal.
  const [activeId, setActiveId] = useState<string | null>(null);
  // Guards against double-close (event bubbling, rapid Esc+click…): a second
  // history.back() would jump past the gallery onto a stale history entry.
  const closingRef = useRef(false);

  const openItem = useCallback((item: Item) => {
    closingRef.current = false;
    // Name the clicked tile synchronously so the "old" snapshot sees it…
    flushSync(() => setActiveId(item.id));
    window.history.pushState({ itemModal: true }, "", `/item/${item.id}`);
    // …then morph: in the "new" snapshot the modal owns the name.
    withViewTransition(() => setSelected(item));
  }, []);

  const closeItem = useCallback(() => {
    if (closingRef.current) return;
    // Go back so the browser history stays consistent; popstate does the
    // actual close (also covers the hardware/browser back button).
    if (window.history.state?.itemModal) {
      closingRef.current = true;
      window.history.back();
    } else {
      withViewTransition(() => setSelected(null));
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      closingRef.current = false;
      if (selectedRef.current) {
        withViewTransition(() => setSelected(null));
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // While navigating prev/next, the modal media takes a fixed transition
  // name: "lb-out" before the swap, "lb-in" after. DISTINCT names on
  // purpose — pairing them would make the browser morph the frame between
  // the two aspect ratios (a scale effect); unpaired, each media keeps its
  // own size and only slides. Per-item names stay for the open/close morph.
  const [navName, setNavName] = useState<"lb-out" | "lb-in" | null>(null);

  // Prev/next inside the lightbox. replaceState (not push): the back button
  // should close the lightbox, not step back through every viewed item.
  const selectedIndex = selected
    ? items.findIndex((i) => i.id === selected.id)
    : -1;
  const prevItem = selectedIndex > 0 ? items[selectedIndex - 1] : null;
  const nextItem =
    selectedIndex >= 0 && selectedIndex < items.length - 1
      ? items[selectedIndex + 1]
      : null;

  const navigateTo = useCallback((target: Item, dir: "prev" | "next") => {
    window.history.replaceState({ itemModal: true }, "", `/item/${target.id}`);
    // 1. Rename the current media "lb-out" BEFORE the snapshot; the new one
    //    renders as "lb-in" inside the transition. 2. The html attribute
    //    tells the CSS which way to slide. Everything is cleared once the
    //    transition ends, restoring the per-item name for the close morph.
    flushSync(() => setNavName("lb-out"));
    document.documentElement.dataset.navDir = dir;
    const transition = withViewTransition(() => {
      setActiveId(target.id); // the close-morph must return to the new tile
      setSelected(target);
      setNavName("lb-in");
    });
    const clear = () => {
      setNavName(null);
      delete document.documentElement.dataset.navDir;
    };
    if (transition) transition.finished.catch(() => {}).finally(clear);
    else clear();
  }, []);

  // Warm the neighbours' media so prev/next feels instant.
  useEffect(() => {
    for (const neighbour of [prevItem, nextItem]) {
      if (!neighbour) continue;
      const url =
        neighbour.type === "video"
          ? neighbour.poster_url
          : neighbour.image_base
            ? `${neighbour.image_base}/${bestWidth(neighbour.width)}.avif`
            : null;
      if (url) new window.Image().src = url;
    }
  }, [prevItem, nextItem]);

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
      // The next page must carry the same filters as the first, otherwise
      // scrolling quietly widens the selection.
      if (filters.type) params.set("type", filters.type);
      if (filters.tag) params.set("tag", filters.tag);
      if (filters.projectType) params.set("projet", filters.projectType);
      if (filters.brand) params.set("marque", filters.brand);
      if (filters.city) params.set("lieu", filters.city);
      const res = await fetch(`/api/items?${params}`);
      const page: ItemsPage = await res.json();
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, filters]);

  // Browsing the lightbox near the end of the loaded list pulls the next
  // page in the background, so "next" rarely hits a wall.
  useEffect(() => {
    if (selected && selectedIndex >= items.length - 2) loadMore();
  }, [selected, selectedIndex, items.length, loadMore]);

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
        <p className="text-sm font-medium">Rien à afficher pour l&apos;instant</p>
        <p className="text-sm text-foreground/60">
          De nouveaux repérages sont ajoutés régulièrement — revenez bientôt.
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
              <GalleryItem
                key={item.id}
                item={item}
                onOpen={openItem}
                transitionName={
                  activeId === item.id && selected?.id !== item.id
                    ? `item-${item.id}`
                    : "none"
                }
              />
            ))}
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="flex h-16 items-center justify-center">
        {loading && <Spinner />}
      </div>
      {selected && (
        <ItemModal
          item={selected}
          mediaTransitionName={navName ?? `item-${selected.id}`}
          onClose={closeItem}
          onPrev={prevItem ? () => navigateTo(prevItem, "prev") : undefined}
          onNext={nextItem ? () => navigateTo(nextItem, "next") : undefined}
        />
      )}
    </div>
  );
}
