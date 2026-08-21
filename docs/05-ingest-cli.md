# Ingest CLI — Deep Dive

The ingest CLI is your entire "upload backend." You run it locally; it compresses,
uploads, and records one gallery item. No server, no UI, no auth.

```
node ingest.js ./new-clip.mov --title "Fluid tab switch" --tags ui,motion --creator "Vercel"
```

---

## What it does, step by step

```
1. Detect type (image vs video) from extension.
2. Probe dimensions (ffprobe / sharp metadata).
3. Compress:
     - image → AVIF + WebP at 400/800/1200/2000 widths
     - video → MP4 (H.264, muted) [+ optional AV1] + poster frame
4. Compute dominant color + tiny blur placeholder (base64).
5. Upload every compressed variant to R2/Bunny (S3-compatible).
6. INSERT one row into Postgres with metadata + resulting CDN URLs.
```

Everything below is reference code — a real, working shape you can adapt.

---

## Dependencies

```bash
npm init -y
npm install @aws-sdk/client-s3 sharp pg commander nanoid
# FFmpeg + ffprobe must be installed on your machine (brew install ffmpeg)
```

- `@aws-sdk/client-s3` — R2 and Bunny are both S3-compatible.
- `sharp` — image resize/convert + blur + dominant color.
- `pg` — Postgres client.
- `commander` — parse CLI flags.
- FFmpeg/ffprobe — called via `child_process` for video.

---

## Environment (`.env`, never commit)

```bash
# Cloudflare R2 (S3-compatible)
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_BUCKET=inspiration-media
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
CDN_BASE_URL=https://cdn.yoursite.com     # public URL that maps to the bucket

# Postgres (Neon)
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
```

---

## Project layout

```
ingest/
├── ingest.js          # entry point / CLI
├── lib/
│   ├── image.js       # image compression
│   ├── video.js       # video compression (ffmpeg)
│   ├── placeholder.js # dominant color + blur
│   ├── upload.js      # S3/R2 upload
│   └── db.js          # Postgres insert
└── .env
```

---

## `lib/upload.js`

```js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const CONTENT_TYPES = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};

// key = path inside bucket, e.g. "items/abc123/800.avif"
export async function uploadFile(localPath, key) {
  const ext = key.slice(key.lastIndexOf("."));
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: await readFile(localPath),
    ContentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
    CacheControl: "public, max-age=31536000, immutable", // media never changes
  }));
  return `${process.env.CDN_BASE_URL}/${key}`;
}

// Upload from a Buffer instead of a file (handy for sharp output)
export async function uploadBuffer(buffer, key) {
  const ext = key.slice(key.lastIndexOf("."));
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${process.env.CDN_BASE_URL}/${key}`;
}
```

> **Cache header note:** because filenames are content-addressed (unique per item
> id) and never change, `immutable, max-age=1y` is safe and makes the CDN cache
> forever. This is a big free speed win.

---

## `lib/placeholder.js`

```js
import sharp from "sharp";

// Dominant color for background before load.
export async function dominantColor(input) {
  const { dominant } = await sharp(input).stats();
  const hex = (n) => n.toString(16).padStart(2, "0");
  return `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`;
}

// Tiny 20px blurred base64 for the blur-up placeholder.
export async function blurDataUrl(input) {
  const buf = await sharp(input)
    .resize(20, 20, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}
```

---

## `lib/image.js`

```js
import sharp from "sharp";
import { uploadBuffer } from "./upload.js";

const WIDTHS = [400, 800, 1200, 2000];

// Produces AVIF + WebP at each width. Frontend picks via <picture>/srcset.
export async function processImage(inputPath, id) {
  const meta = await sharp(inputPath).metadata();

  for (const w of WIDTHS) {
    if (meta.width && w > meta.width) continue; // don't upscale

    const avif = await sharp(inputPath).resize(w).avif({ quality: 50 }).toBuffer();
    await uploadBuffer(avif, `items/${id}/${w}.avif`);

    const webp = await sharp(inputPath).resize(w).webp({ quality: 75 }).toBuffer();
    await uploadBuffer(webp, `items/${id}/${w}.webp`);
  }

  return {
    imageBase: `items/${id}`,          // frontend builds `${base}/${w}.avif`
    width: meta.width,
    height: meta.height,
  };
}
```

---

## `lib/video.js`

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { uploadFile, uploadBuffer } from "./upload.js";

const run = promisify(execFile);

async function probeDimensions(inputPath) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0:s=x",
    inputPath,
  ]);
  const [width, height] = stdout.trim().split("x").map(Number);
  return { width, height };
}

export async function processVideo(inputPath, id) {
  const { width, height } = await probeDimensions(inputPath);

  // 1. Compressed, muted, faststart MP4 (H.264)
  const mp4Path = join(tmpdir(), `${id}.mp4`);
  await run("ffmpeg", [
    "-i", inputPath,
    "-vf", "scale='min(1920,iw)':-2",
    "-c:v", "libx264", "-profile:v", "high", "-crf", "26", "-preset", "slow",
    "-movflags", "+faststart",
    "-an",                 // strip audio for hover previews
    "-y", mp4Path,
  ]);
  const videoUrl = await uploadFile(mp4Path, `items/${id}/video.mp4`);

  // 2. Poster frame at 1s → AVIF + JPEG
  const posterPng = join(tmpdir(), `${id}-poster.png`);
  await run("ffmpeg", [
    "-i", mp4Path, "-ss", "00:00:01", "-frames:v", "1", "-y", posterPng,
  ]);
  const posterAvif = await sharp(posterPng).resize(1200).avif({ quality: 55 }).toBuffer();
  const posterUrl = await uploadBuffer(posterAvif, `items/${id}/poster.avif`);

  // (optional) AV1 variant:
  // const av1Path = join(tmpdir(), `${id}.av1.mp4`);
  // await run("ffmpeg", ["-i", inputPath, "-vf", "scale='min(1920,iw)':-2",
  //   "-c:v", "libsvtav1", "-crf", "32", "-preset", "6", "-an", "-y", av1Path]);
  // const videoAv1Url = await uploadFile(av1Path, `items/${id}/video.av1.mp4`);

  return { videoUrl, posterUrl, posterPng, width, height };
}
```

---

## `lib/db.js`

```js
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function insertItem(row) {
  const {
    id, type, title, description, tags, category, creator, sourceUrl,
    width, height, dominantColor, blurDataUrl,
    posterUrl, imageBase, videoUrl, videoAv1Url,
  } = row;

  await pool.query(
    `insert into items
       (id, type, title, description, tags, category, creator, source_url,
        width, height, dominant_color, blur_data_url,
        poster_url, image_base, video_url, video_av1_url)
     values
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [id, type, title, description, tags, category, creator, sourceUrl,
     width, height, dominantColor, blurDataUrl,
     posterUrl, imageBase, videoUrl, videoAv1Url ?? null]
  );
}
```

---

## `ingest.js` (entry point)

```js
import "dotenv/config";
import { Command } from "commander";
import { nanoid } from "nanoid";
import { extname } from "node:path";
import { processImage } from "./lib/image.js";
import { processVideo } from "./lib/video.js";
import { dominantColor, blurDataUrl } from "./lib/placeholder.js";
import { insertItem } from "./lib/db.js";

const VIDEO_EXT = new Set([".mov", ".mp4", ".webm", ".m4v"]);

const program = new Command();
program
  .argument("<file>", "path to the source image or video")
  .option("--title <title>", "item title")
  .option("--description <desc>", "description")
  .option("--tags <tags>", "comma-separated tags", (v) => v.split(","))
  .option("--category <cat>", "category")
  .option("--creator <name>", "who made it")
  .option("--source <url>", "original inspiration link")
  .parse();

const file = program.args[0];
const opts = program.opts();
const id = nanoid(10);
const isVideo = VIDEO_EXT.has(extname(file).toLowerCase());

console.log(`→ ingesting ${isVideo ? "video" : "image"} as ${id}`);

let media;
if (isVideo) {
  const v = await processVideo(file, id);            // mp4 + poster
  const color = await dominantColor(v.posterPng);
  const blur = await blurDataUrl(v.posterPng);
  media = {
    type: "video",
    width: v.width, height: v.height,
    dominantColor: color, blurDataUrl: blur,
    posterUrl: v.posterUrl, videoUrl: v.videoUrl,
    imageBase: null, videoAv1Url: null,
  };
} else {
  const img = await processImage(file, id);          // avif/webp variants
  const color = await dominantColor(file);
  const blur = await blurDataUrl(file);
  media = {
    type: "image",
    width: img.width, height: img.height,
    dominantColor: color, blurDataUrl: blur,
    imageBase: img.imageBase, posterUrl: null,
    videoUrl: null, videoAv1Url: null,
  };
}

await insertItem({
  id,
  title: opts.title ?? null,
  description: opts.description ?? null,
  tags: opts.tags ?? [],
  category: opts.category ?? null,
  creator: opts.creator ?? null,
  sourceUrl: opts.source ?? null,
  ...media,
});

console.log(`✓ done — item ${id} live after next revalidation`);
process.exit(0);
```

---

## Usage examples

```bash
# A video
node ingest.js ./exports/tab-switch.mov \
  --title "Fluid tab switch" --tags ui,motion,micro \
  --creator "Vercel" --source "https://vercel.com"

# An image
node ingest.js ./exports/pricing-page.png \
  --title "Pricing layout" --tags landing,pricing --creator "Linear"
```

---

## Import en masse depuis un dossier Google Drive

`worker/sync-drive.js` est le pendant « one-shot » du robot Notion : il prend un
dossier Drive partagé et fait passer **chaque vidéo/image** par exactement le même
pipeline (compression → stockage → ligne en base).

```bash
cd ingest

# 1. Lister sans rien importer (aucun accès base ni R2 requis)
node worker/sync-drive.js --dry-run "https://drive.google.com/drive/folders/<id>"

# 2. Importer pour de vrai, avec des métadonnées communes
node worker/sync-drive.js "https://drive.google.com/drive/folders/<id>" \
  --tags motion,3d --creator "Alessia"

# On peut aussi passer des liens de fichiers un par un
node worker/sync-drive.js "https://drive.google.com/file/d/<id>/view"
```

**Le dossier doit être partagé en « Toute personne disposant du lien ».** Drive
n'expose aucune API de listing anonyme : le script lit le blob de données de la
page du dossier. C'est un format privé de Google qui peut changer — si le listing
ressort vide, on passe la liste à la main :

```bash
# fichiers.json : [{ "id": "<drive file id>", "name": "clip.mp4" }, …]
node worker/sync-drive.js --manifest fichiers.json
```

Chaque ligne créée porte `import_key = "drive:<id>"` : **relancer le script est
sans risque**, les fichiers déjà importés sont sautés. Cette clé est technique et
n'est jamais affichée — le lien Drive ne fuite pas dans `source_url`, qui est
rendu publiquement sur la page de l'item.

Le titre est déduit du nom de fichier (`gradient-flow_v2.mp4` → « Gradient flow v2 »).

Le script refuse de tourner en **stockage local** : `web/public/media/` est
gitignoré, les fichiers n'arriveraient jamais sur Vercel. R2 est donc obligatoire
(voir `TODO-lucas.md`).

---

## Nice upgrades later
- **Batch mode:** `node ingest.js ./folder --tags ...` loops a directory.
- **Dry run:** `--dry` to compress + report sizes without uploading.
- ~~**Idempotency:** skip if an item with the same source hash already exists.~~
  → fait pour l'import Drive via `import_key`.
- **Re-encode command:** regenerate variants for an existing id if you change specs.
- **Sidecar metadata:** read a `clip.json` next to each file so you don't retype flags.
```
```
