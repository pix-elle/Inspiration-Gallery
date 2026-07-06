# Putting It Together — Concrete Recommended Stack

A single-page summary of the whole system, tuned to your constraints:
**you are the only uploader, no upload UI, optimize for load speed and low cost.**

---

## The full stack at a glance

| Layer | Choice | Role |
|---|---|---|
| **Frontend** | Next.js (App Router) + TypeScript + Tailwind | Server-rendered gallery, fast first paint |
| **Gallery UX** | Virtualized masonry (`react-virtuoso`) + lazy load + blur placeholders + infinite scroll | Only fetch what's on screen |
| **Hosting / CDN** | Vercel (or Cloudflare Pages) | Global edge, zero-config deploy |
| **Images** | Cloudflare Images / Bunny Optimizer **or** pre-generated AVIF/WebP variants on R2 | Right format + size per device |
| **Video** | DIY FFmpeg → MP4 (+AV1) on **Bunny/R2 CDN** | Compressed locally, served from edge |
| **Original media storage** | Cloudflare R2 (zero egress fees) | Compressed variants + master copies |
| **Database** | Postgres (Neon or Supabase) | Item metadata + media URLs only |
| **Ingestion** | **Local Node CLI script** (FFmpeg + sharp + S3 SDK) | Compress → upload → insert row |

---

## Architecture diagram

```
   ┌──────────────────────────────────────────────────────────┐
   │                        VISITORS                            │
   └───────────────┬───────────────────────────┬──────────────┘
                   │ HTML + metadata            │ media files
                   ▼                            ▼
        ┌────────────────────┐        ┌────────────────────┐
        │  Next.js / Vercel  │        │   CDN edge          │
        │  (SSR + edge cache)│        │  (R2 / Bunny)       │
        └─────────┬──────────┘        └─────────▲──────────┘
                  │ reads                        │ serves
                  ▼                              │ compressed
        ┌────────────────────┐                  │ images+video
        │  Postgres (Neon)   │                  │
        │  metadata + URLs   │                  │
        └─────────▲──────────┘                  │
                  │ writes                       │ uploads
                  │                              │
        ┌─────────┴──────────────────────────────┴──────────┐
        │   YOU — local ingest CLI (runs on your machine)    │
        │   FFmpeg + sharp → compress → upload → insert row  │
        └───────────────────────────────────────────────────┘
```

Public side is **read-only**. The only writer is your local script.

---

## How a request flows (visitor loads the gallery)
1. Browser hits Vercel → gets **server-rendered HTML** with the first page of items
   (already includes blur placeholders + reserved dimensions → no layout shift).
2. Grid is **virtualized** → only ~20 tiles render.
3. Each visible tile lazy-loads its **image variant** (AVIF, sized to the device)
   from the CDN edge.
4. Video tiles show a **poster**; the muted clip loads/plays only on hover / in view.
5. Scrolling triggers a **cursor-paginated** fetch for the next page.
6. Everything media is a **CDN edge hit** — no origin round-trip.

## How a request flows (you add a new item)
1. Run `node ingest.js ./clip.mov --title "…" --tags ui,motion`.
2. Script compresses (FFmpeg/sharp), extracts poster, generates image widths,
   computes color + blur.
3. Script uploads compressed variants to R2/Bunny.
4. Script inserts a row into Postgres.
5. Next revalidation → item appears in the gallery.

---

## Why this stack wins on speed
- **Media is the payload; it's compressed hard and served from the edge.**
- Images: AVIF/WebP, responsive `srcset`, lazy-loaded.
- Video: locally compressed MP4, muted, poster-first, play-on-view.
- Frontend: SSR + virtualized + paginated → tiny initial JS/DOM.
- DB is thin and cacheable; content changes rarely → aggressive edge caching.

## Why this stack wins on cost
- No transcoding service (FFmpeg runs free on your CPU).
- No upload backend to run/scale (local CLI).
- **R2 = zero egress fees** — the usual killer bill for media sites is gone.
- Vercel + Neon free/cheap tiers cover early traffic.

Early-stage cost is essentially: **~$0–a few dollars/month**, scaling gently with
bandwidth as traffic grows. Video/CDN delivery is the main variable line item.

---

## Build order (suggested)
1. **DB + schema** (Neon Postgres).
2. **Ingest CLI** — get one image and one video into the DB + CDN end to end.
3. **Read API / Server Components** — paginated feed.
4. **Gallery UI** — virtualized masonry, lazy load, placeholders.
5. **Item detail view**.
6. Polish: filtering by tag, search, SEO/OG tags.
7. *Later, only if needed:* likes/auth, managed video (Bunny Stream/Mux), admin UI.

---

## One-line summary
> Next.js on Vercel for a virtualized, lazy-loaded gallery; Postgres holds only
> metadata; a local FFmpeg/sharp CLI compresses and uploads media to a
> zero-egress CDN (R2/Bunny). Media is compressed hard and edge-served — that's
> where the speed comes from. No upload UI, no transcode service, minimal cost.
