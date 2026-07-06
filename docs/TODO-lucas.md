# Your Tasks (manual setup)

Things only you can do — account setup, credentials, DNS. Check them off as you go.

## Cloudflare R2 (needed before real media goes live)

- [ ] Create a Cloudflare account (or log in) → https://dash.cloudflare.com
- [ ] R2 → **Create bucket** — name: `inspiration-media` (region: automatic)
- [ ] R2 → **Manage R2 API Tokens** → Create API token
      - Permission: **Object Read & Write**, scoped to the `inspiration-media` bucket
      - Save the **Access Key ID** and **Secret Access Key** (shown once)
- [ ] Enable public access for the bucket:
      - Easiest: bucket → Settings → **R2.dev subdomain** → Allow access
        (gives you a `https://pub-xxxx.r2.dev` URL — fine for development)
      - Later/production: connect a **custom domain** (e.g. `cdn.yoursite.com`)
        on the bucket so media is served through Cloudflare's CDN with caching
- [ ] Put the values in `web/.env.local` (and later in `ingest/.env`):

```bash
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_BUCKET=inspiration-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
CDN_BASE_URL=https://pub-xxxx.r2.dev        # or https://cdn.yoursite.com
```

- [ ] Tell Claude it's done → the ingest CLI gets switched from local storage to R2
      (it's a one-line env change; everything is built to be R2-ready)

## Later (not blocking anything yet)

- [ ] Buy/choose the domain for the site
- [ ] Create a Vercel account for deployment (Phase 7)
- [ ] `brew install ffmpeg` if not already installed (needed for video ingestion —
      Claude will check this during Phase 3)
