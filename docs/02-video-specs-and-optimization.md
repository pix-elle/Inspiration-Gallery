# Video & Image Specs + Optimization Process

> Context: **You (the admin) are the only uploader**, and you don't need a web
> interface. Ingestion is a **local script you run from your machine** (see
> `03-backend-architecture.md`). That means all heavy compression can happen
> **on your computer before upload** — you have full control and zero per-minute
> transcoding fees if you do it yourself.

---

## The golden rule
**Never serve the raw file you exported from your editor.**
A raw 10-second design demo can be 30–50 MB. Compressed correctly it's 1–3 MB with
no visible quality loss. Every file goes through compression before it reaches a user.

---

## VIDEO

### Output formats (what users actually download)

| Use case | Format / codec | Notes |
|---|---|---|
| Short looping clips (< ~15s) | **MP4 (H.264)** muted | Universal, simplest. Good default for hover previews. |
| Better compression (optional) | **WebM (VP9)** or **MP4 (AV1)** | 30–50% smaller than H.264, more encode time. Add as a secondary source with H.264 fallback. |
| Longer videos (> ~15s) | **HLS** (adaptive bitrate) | Chopped into segments at multiple qualities; player picks based on connection. No buffering, instant start. |

### Recommended encoding specs (short clips)
- **Container:** MP4 (`.mp4`), `faststart` flag ON (moves metadata to front so it
  starts playing before fully downloaded).
- **Codec:** H.264 (High profile).
- **Resolution:** cap at **1080p**; 720p is plenty for grid previews.
- **Frame rate:** 30fps (24–30 fine).
- **Bitrate:** target **1–2.5 Mbps** for 1080p UI/design content (it compresses
  well because of flat colors).
- **Audio:** **strip it entirely** for hover previews (muted anyway) → big savings.
- **CRF (quality mode):** 23–28 (lower = higher quality/bigger). Start at 26.

### FFmpeg commands (run locally before upload)

**Short muted preview clip (H.264 MP4):**
```bash
ffmpeg -i input.mov \
  -vf "scale='min(1920,iw)':-2" \
  -c:v libx264 -profile:v high -crf 26 -preset slow \
  -movflags +faststart \
  -an \
  output.mp4
```

**Smaller AV1 version (optional, for modern browsers):**
```bash
ffmpeg -i input.mov \
  -vf "scale='min(1920,iw)':-2" \
  -c:v libsvtav1 -crf 32 -preset 6 \
  -an \
  output.av1.mp4
```

**Generate a poster/thumbnail (still frame at 1 second):**
```bash
ffmpeg -i output.mp4 -ss 00:00:01 -frames:v 1 -q:v 3 poster.jpg
```

**Convert to HLS (for longer videos, adaptive bitrate):**
```bash
ffmpeg -i input.mov \
  -c:v libx264 -crf 23 -preset slow \
  -hls_time 6 -hls_playlist_type vod \
  -master_pl_name master.m3u8 \
  output_%v.m3u8
```
(For true multi-bitrate HLS you'd encode 2–3 renditions; a managed service does
this for you — see the "build vs. buy" note below.)

---

## IMAGES

### Output formats

| Format | Use | Notes |
|---|---|---|
| **AVIF** | Primary | ~50% smaller than JPEG at equal quality. |
| **WebP** | Fallback | ~30% smaller than JPEG, wider support. |
| **JPEG** | Last resort | Universal. |

### Specs
- **Max dimension:** 2000px on the long edge for the "full" view; generate
  400 / 800 / 1200 as well for `srcset`.
- **Quality:** AVIF ~50, WebP ~75 (visually lossless for UI screenshots).
- Store a **dominant color** and a **~20px blur placeholder** per image for the
  blur-up effect.

### FFmpeg / CLI image commands
```bash
# AVIF (primary)
ffmpeg -i input.png -c:v libaom-av1 -crf 30 -still-picture 1 output.avif

# WebP (fallback)
cwebp -q 75 input.png -o output.webp

# Or use `sharp` (Node) in your ingest script to generate all widths + formats at once.
```

---

## The optimization pipeline (per asset)

```
1. Export original from your editor (keep this — it's your master copy).
2. Run local FFmpeg/sharp script:
     - compress video → MP4 (+ optional AV1)
     - extract poster frame
     - generate image variants (AVIF/WebP, 4 widths)
     - compute dominant color + blur placeholder
3. Upload compressed variants to storage/CDN (R2 / Bunny / Mux).
4. Write metadata + variant URLs to the database.
```

---

## Build vs. buy for video

| Option | You do | Cost | When |
|---|---|---|---|
| **DIY FFmpeg (local)** | Encode on your machine, upload to R2/Bunny, serve MP4/HLS | Storage + bandwidth only (cents) | Best fit: **admin-only, few uploads, full control**. Recommended starting point. |
| **Bunny Stream** | Upload original via API, they transcode + serve + player | Cheap ($/GB) | If you want zero FFmpeg hassle. |
| **Mux** | POST original, get HLS + thumbnails + analytics | Per-minute stored + delivered | If you need pro streaming/analytics later. |
| **Cloudflare Stream** | Upload, they handle HLS + CDN | Flat-ish per minute | If already on Cloudflare. |

**Recommendation for your case:** since you're the only uploader and you're
comfortable running a script, **DIY FFmpeg locally + upload compressed files to
Cloudflare R2 or Bunny CDN** is the cheapest and simplest. Move to Bunny Stream /
Mux only if/when you have longer videos that need adaptive streaming.

---

## Target sizes (sanity check)
- Short hover-preview clip (1080p, muted, ~8s): **~1–2 MB**
- Full image (2000px AVIF): **~150–400 KB**
- Grid thumbnail (400px AVIF): **~15–40 KB**
- Poster frame (JPEG): **~30–60 KB**

If a clip is over ~4 MB, it's under-compressed — re-encode.
