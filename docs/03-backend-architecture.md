# Backend / Data Architecture

> Key constraint: **you are the only uploader and you do NOT need an upload UI.**
> This removes the hardest parts of a normal media backend — no user auth for
> uploads, no signed-URL flow, no upload interface, no moderation queue. Ingestion
> is a **local CLI script** you run from your own machine.

---

## The mental model

The backend is a **thin catalog service**. It stores *metadata and pointers*,
never the media files themselves. The media lives in object storage + CDN.

```
                    ┌──────────────────────────────┐
   Visitors ─────▶  │  Next.js frontend (Vercel)    │
                    └──────────────┬────────────────┘
                                   │ reads metadata (paginated)
                                   ▼
                    ┌──────────────────────────────┐
                    │  Postgres (item metadata)     │  ← Neon or Supabase
                    │  title, tags, dims, color,    │
                    │  media URLs / IDs             │
                    └──────────────────────────────┘
                                   ▲
                                   │ writes rows after upload
                    ┌──────────────┴────────────────┐
   YOU (admin) ──▶  │  Local ingest CLI script       │
   run on your PC   │  1. compress with FFmpeg/sharp │
                    │  2. upload variants to CDN     │
                    │  3. insert row into Postgres   │
                    └──────────────┬────────────────┘
                                   │ uploads compressed files
                                   ▼
                    ┌──────────────────────────────┐
   Visitors  ◀───── │  Object storage + CDN         │  ← Cloudflare R2 / Bunny
   fetch media      │  (compressed images + video)  │
                    └──────────────────────────────┘
```

**Nothing on the public site can write.** The only writer is your local script.

---

## Components

### 1. Database — Postgres (Neon or Supabase)
Stores one row per gallery item. Never stores media, only URLs/metadata.

Example schema:
```sql
create table items (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,          -- 'image' | 'video'
  title         text,
  description   text,
  tags          text[],                 -- for filtering
  category      text,
  source_url    text,                   -- original inspiration link, optional
  creator       text,                   -- who made the design

  -- layout / placeholder
  width         int not null,
  height        int not null,
  dominant_color text,                  -- e.g. '#3b82f6'
  blur_data_url text,                   -- tiny base64 LQIP

  -- media pointers (filled by ingest script)
  poster_url    text,                   -- still frame / thumbnail
  image_base    text,                   -- CDN base path; frontend appends width+format
  video_url     text,                   -- mp4 or HLS .m3u8 URL
  video_av1_url text,                   -- optional smaller variant

  created_at    timestamptz default now()
);

create index on items (created_at desc);   -- cursor pagination
create index on items using gin (tags);     -- tag filtering
```

### 2. Object storage + CDN — Cloudflare R2 or Bunny
- Holds the **compressed** image variants and video files.
- **Cloudflare R2 / Backblaze B2 have zero egress fees** — critical for a media
  site (AWS S3 charges heavily for bandwidth).
- Files are public-read; served through the CDN edge, cached globally.
- Keep your **original masters** in a separate private bucket or just on your disk —
  users never touch them.

### 3. Read API
Two simple read endpoints, both public and cacheable:
- `GET /api/items?cursor=<ts>&limit=30&tag=<optional>` → paginated feed.
- `GET /api/items/:id` → single item detail.

With Next.js App Router you can skip a separate API layer entirely and query
Postgres directly in Server Components, then cache the responses at the edge.
Because the data changes rarely (only when you add items), you can cache
aggressively (ISR / `revalidate`).

---

## The ingest flow (your local script)

You run something like `node ingest.js ./new-clip.mov --title "..." --tags ui,motion`.
The script does everything:

```
1. Read the original file from your disk.
2. Compress with FFmpeg (video) / sharp (images):
     - video  → MP4 (+ optional AV1) + poster frame
     - image  → AVIF/WebP at 400/800/1200/2000 widths
3. Compute width, height, dominant color, blur placeholder.
4. Upload all compressed variants to R2/Bunny (S3-compatible SDK).
5. INSERT a row into Postgres with the metadata + resulting CDN URLs.
```

That's the entire "backend for uploads." No server endpoint, no auth, no UI.
Everything runs on your machine and talks directly to storage + DB.

### Why this is the right design for you
- **Simplest possible:** no upload server to build, secure, or scale.
- **Cheapest:** compression happens on your CPU for free; no per-minute transcode fees.
- **Full control:** you decide exact compression settings per asset.
- **Safe:** the public site is effectively read-only, so there's almost nothing to hack.

---

## Optional later additions (not needed at launch)
- **Search:** Postgres full-text search, or Meilisearch/Typesense if it grows.
- **Likes / saves:** would introduce your first *write* from visitors → then you add
  auth (Clerk/Supabase Auth) + a `likes` table. Keep it out until you need it.
- **Managed video (Bunny Stream / Mux):** swap the "compress + upload" step for an
  API upload if you start hosting long, adaptive-bitrate videos.
- **Admin dashboard:** only if you tire of the CLI. The CLI covers 100% of needs now.

---

## What NOT to build
- ❌ An upload interface (you don't need one).
- ❌ User accounts / signed upload URLs (only you upload, locally).
- ❌ A transcoding service on a server (do it locally with FFmpeg).
- ❌ Storing media in the database (store URLs only).
- ❌ Loading the whole catalog per request (paginate).
