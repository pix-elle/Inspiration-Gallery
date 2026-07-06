# Gallery Component Structure — Deep Dive

How the front-end is organized so the gallery feels instant: server-rendered first
page, virtualized masonry, lazy media, blur-up placeholders, play-on-view video,
and cursor-paginated infinite scroll.

---

## Component tree

```
app/
├── page.tsx                  # Server Component — renders first page (SSR)
├── api/items/route.ts        # Cursor-paginated JSON feed (for infinite scroll)
├── item/[id]/page.tsx        # Item detail (Server Component)
└── components/
    ├── Gallery.tsx           # Client — virtualized masonry + infinite scroll
    ├── GalleryItem.tsx       # Client — one tile (routes to Image/Video)
    ├── ImageTile.tsx         # <picture> + srcset + blur-up
    ├── VideoTile.tsx         # poster + play-on-view (IntersectionObserver)
    └── useInViewVideo.ts     # hook: play when visible, pause when not
```

**Split of responsibilities:**
- **Server Components** fetch metadata + render initial HTML (fast first paint, SEO).
- **Client Components** handle virtualization, scroll, and video playback.

---

## Data shape (what the API returns per item)

```ts
type Item = {
  id: string;
  type: "image" | "video";
  title: string | null;
  tags: string[];
  width: number;
  height: number;
  dominantColor: string;      // e.g. "#3b82f6"
  blurDataUrl: string;        // tiny base64 LQIP
  posterUrl: string | null;   // video poster / thumbnail
  imageBase: string | null;   // "https://cdn../items/abc"; append /800.avif
  videoUrl: string | null;
};
```

---

## 1. Server-rendered first page — `app/page.tsx`

```tsx
import { getItems } from "@/lib/queries";
import { Gallery } from "@/components/Gallery";

// Revalidate periodically; content only changes when you ingest.
export const revalidate = 300; // 5 min ISR — near-static, edge-cached

export default async function HomePage() {
  const { items, nextCursor } = await getItems({ limit: 30 });
  return <Gallery initialItems={items} initialCursor={nextCursor} />;
}
```

`getItems` queries Postgres directly (cursor pagination):

```ts
// lib/queries.ts
export async function getItems({ limit = 30, cursor, tag }) {
  const rows = await sql`
    select * from items
    where (${cursor}::timestamptz is null or created_at < ${cursor})
      and (${tag}::text is null or ${tag} = any(tags))
    order by created_at desc
    limit ${limit + 1}
  `;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;
  return { items, nextCursor };
}
```

---

## 2. Paginated API — `app/api/items/route.ts`

```ts
import { getItems } from "@/lib/queries";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const tag = url.searchParams.get("tag");
  const data = await getItems({ limit: 30, cursor, tag });
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
```

---

## 3. Virtualized masonry + infinite scroll — `Gallery.tsx`

Uses `react-virtuoso`'s `VirtuosoMasonry` (or `VirtuosoGrid`) so only on-screen
tiles are in the DOM, and loads the next page as you approach the bottom.

```tsx
"use client";
import { useState, useCallback } from "react";
import { VirtuosoMasonry } from "@virtuoso.dev/masonry";
import { GalleryItem } from "./GalleryItem";

export function Gallery({ initialItems, initialCursor }) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !cursor) return;
    setLoading(true);
    const res = await fetch(`/api/items?cursor=${encodeURIComponent(cursor)}`);
    const { items: next, nextCursor } = await res.json();
    setItems((prev) => [...prev, ...next]);
    setCursor(nextCursor);
    setLoading(false);
  }, [cursor, loading]);

  return (
    <VirtuosoMasonry
      columnCount={{ 0: 2, 768: 3, 1280: 4 }}  // responsive columns
      data={items}
      endReached={loadMore}                     // infinite scroll trigger
      ItemContent={({ data }) => <GalleryItem item={data} />}
    />
  );
}
```

> Only ~20–30 tiles ever exist in the DOM regardless of catalog size. This is the
> single biggest scalability win for the gallery.

---

## 4. One tile — `GalleryItem.tsx`

The wrapper reserves the correct space **before** media loads (from `width`/`height`)
so there's no layout shift, and paints the dominant color underneath.

```tsx
"use client";
import { ImageTile } from "./ImageTile";
import { VideoTile } from "./VideoTile";

export function GalleryItem({ item }) {
  const aspect = item.width / item.height;
  return (
    <a
      href={`/item/${item.id}`}
      className="block rounded-lg overflow-hidden"
      style={{ aspectRatio: aspect, backgroundColor: item.dominantColor }}
    >
      {item.type === "video"
        ? <VideoTile item={item} />
        : <ImageTile item={item} />}
    </a>
  );
}
```

---

## 5. Image tile — `ImageTile.tsx`

`<picture>` negotiates AVIF → WebP, `srcset` picks the right width, blur-up shows
instantly, and `loading="lazy"` defers off-screen fetches.

```tsx
"use client";
import { useState } from "react";

const WIDTHS = [400, 800, 1200, 2000];

export function ImageTile({ item }) {
  const [loaded, setLoaded] = useState(false);
  const srcset = (fmt: string) =>
    WIDTHS.map((w) => `${item.imageBase}/${w}.${fmt} ${w}w`).join(", ");

  return (
    <div className="relative w-full h-full">
      {/* blur-up placeholder */}
      <img
        src={item.blurDataUrl}
        aria-hidden
        className={`absolute inset-0 w-full h-full object-cover
                    transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`}
      />
      <picture>
        <source type="image/avif" srcSet={srcset("avif")}
                sizes="(max-width:768px) 50vw, 25vw" />
        <source type="image/webp" srcSet={srcset("webp")}
                sizes="(max-width:768px) 50vw, 25vw" />
        <img
          src={`${item.imageBase}/800.webp`}
          alt={item.title ?? ""}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className="w-full h-full object-cover"
        />
      </picture>
    </div>
  );
}
```

---

## 6. Video tile — `VideoTile.tsx` + `useInViewVideo.ts`

Shows the **poster** by default; only loads and plays the muted clip when the tile
is on screen (and pauses/unloads when it scrolls away). This keeps bandwidth sane
even with many video tiles.

```ts
// useInViewVideo.ts
"use client";
import { useEffect, useRef } from "react";

export function useInViewVideo(src: string) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!el.src) el.src = src;   // lazy-attach source
          el.play().catch(() => {});
        } else {
          el.pause();
          // optional: el.removeAttribute("src"); el.load();  // free memory
        }
      },
      { rootMargin: "200px", threshold: 0.25 } // start slightly before visible
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return ref;
}
```

```tsx
// VideoTile.tsx
"use client";
import { useInViewVideo } from "./useInViewVideo";

export function VideoTile({ item }) {
  const ref = useInViewVideo(item.videoUrl);
  return (
    <video
      ref={ref}
      poster={item.posterUrl}
      muted
      loop
      playsInline
      preload="none"          // nothing loads until in view
      className="w-full h-full object-cover"
    />
  );
}
```

**Desktop alternative:** play on hover instead of on view — attach/play in
`onMouseEnter`, pause in `onMouseLeave`. On touch devices, in-view autoplay is the
better UX. You can support both.

---

## 7. Item detail — `app/item/[id]/page.tsx`

Server-rendered, full-resolution, good OG tags for sharing.

```tsx
import { getItem } from "@/lib/queries";

export async function generateMetadata({ params }) {
  const item = await getItem(params.id);
  return {
    title: item.title,
    openGraph: { images: [item.posterUrl ?? `${item.imageBase}/1200.webp`] },
  };
}

export default async function ItemPage({ params }) {
  const item = await getItem(params.id);
  return (
    <main className="max-w-4xl mx-auto p-6">
      {item.type === "video"
        ? <video src={item.videoUrl} poster={item.posterUrl} controls autoPlay muted loop />
        : <img src={`${item.imageBase}/2000.avif`} alt={item.title ?? ""} />}
      <h1>{item.title}</h1>
      {/* tags, creator, source link */}
    </main>
  );
}
```

---

## Why each piece exists (map to the speed goals)

| Technique | Component | Speed effect |
|---|---|---|
| SSR first page + ISR | `page.tsx` | Fast first paint, edge-cached, SEO |
| Virtualization | `Gallery.tsx` | DOM stays small no matter the catalog size |
| Cursor pagination | `api/items` + `getItems` | Never loads the whole catalog |
| Reserved aspect ratio + color | `GalleryItem.tsx` | Zero layout shift (good CLS) |
| Blur-up placeholder | `ImageTile.tsx` | Instant visual, no blank tiles |
| AVIF/WebP + srcset | `ImageTile.tsx` | Smallest correct image per device |
| Lazy load | `ImageTile` / `VideoTile` | Off-screen media never fetched |
| Poster + play-on-view | `VideoTile.tsx` | Video bandwidth only for visible tiles |
| Immutable CDN cache | (from ingest headers) | Repeat views are instant edge hits |

---

## Filtering (when you add it)
- Tags are already in the API (`?tag=ui`). Add a tag bar that pushes `?tag=` to the
  URL and resets the feed. Keep filtering **server-side** (SQL `= any(tags)`),
  not by loading everything and filtering client-side.
- For search later: Postgres full-text first; Meilisearch/Typesense only if it grows.
```
