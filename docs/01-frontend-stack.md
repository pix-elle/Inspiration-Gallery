# Frontend Stack

## Core principle
The framework is a thin wrapper around the media. Perceived speed comes from
**what the browser fetches and when**, not from which React framework you pick.
Optimize the media pipeline first; the frontend's job is to fetch as little as
possible, as late as possible.

---

## Recommended stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | Server-rendered HTML = fast first paint + SEO. Built-in image optimization, streaming, route-based code splitting. Industry default for this kind of site. |
| Language | **TypeScript** | Safer as the catalog + filtering logic grows. |
| Styling | **Tailwind CSS** | Tiny production CSS, fast to build. |
| Hosting / CDN | **Vercel** (or Cloudflare Pages) | Global edge, zero-config Next.js deploy, automatic caching. |
| Data fetching | **React Server Components + paginated API** | Fetch metadata on the server, stream HTML. Never ship the whole catalog to the client. |

### Alternative
If the site is *mostly* static browsing with little interactivity (no likes,
no auth), **Astro** ships even less JavaScript. But Next.js is the safer default
for an app that will grow filtering, search, and admin features.

---

## The four perceived-speed techniques (these matter most)

### 1. Virtualized grid
Only render the ~20 items visible on screen, not all 2,000 in the catalog.
Without this, a large gallery locks up the browser.
- Library: **`react-virtuoso`** (easiest masonry + infinite scroll) or **TanStack Virtual**.

### 2. Lazy loading
Load images/videos only as they scroll into view.
- Images: `loading="lazy"` on `<img>`.
- Videos: `IntersectionObserver` — only attach the video source and play when the
  tile enters the viewport; pause and detach when it leaves.

### 3. Blur-up placeholders (LQIP)
Show a tiny blurred preview instantly so nothing renders blank.
- Store a **dominant color** and/or a **~20px base64 blur** per item in the database.
- Next.js `<Image>` supports `placeholder="blur"` natively.

### 4. Infinite scroll with paginated data
Never load the whole catalog. Fetch pages of ~20–40 items as the user scrolls.
- Cursor-based pagination (by `created_at` or `id`) scales better than offset.

---

## Media rendering rules

### Images
- Use Next.js `<Image>` **or** point directly at an image CDN (Cloudflare Images /
  Bunny Optimizer).
- Always provide `srcset` with multiple widths (400 / 800 / 1200 / 2000px) so a
  phone never downloads a desktop-sized image.
- Serve **AVIF → WebP → JPEG** (browser negotiates automatically).

### Video tiles
- The grid shows a **poster image (still frame)**, never a playing video by default.
- Play on **hover** (desktop) or **when in view** (mobile), muted + looped.
- Short clips (< ~15s): plain muted MP4/WebM.
- Longer clips: HLS via a `<video>` + hls.js or a hosted player (Mux/Bunny/CF Stream).
- Always set `preload="none"` and attach the source lazily.

---

## Gallery layout
- **Masonry / justified grid** (Pinterest-style) — items keep their aspect ratio.
- Store each item's `width`/`height` in the DB so the grid reserves the correct
  space **before** the media loads → prevents layout shift (good CLS score).

---

## Performance checklist
- [ ] Virtualized grid (only render on-screen items)
- [ ] Lazy load all media below the fold
- [ ] Blur/color placeholder for every item
- [ ] Cursor-paginated API, ~20–40 items per page
- [ ] Responsive `srcset` on every image
- [ ] Poster frames for all videos; play only on hover/in-view
- [ ] Reserve item dimensions to avoid layout shift
- [ ] Media served from a CDN, not from the origin server
