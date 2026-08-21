# Your Tasks (manual setup)

Things only you can do — account setup, credentials, DNS. Check them off as you go.

## Cloudflare R2 — ✅ fait (bucket `alessia-inspiration`)

> Deux pièges rencontrés au montage, à connaître si tu recrées tout un jour :
> le nom de bucket ci-dessous était un **exemple** (le vrai est
> `alessia-inspiration`), et l'endpoint `https://<id>.eu.r2.cloudflarestorage.com`
> ne voit *que* les buckets créés en juridiction EU — pour un bucket standard
> il faut `https://<id>.r2.cloudflarestorage.com`, sans le `.eu`.

- [x] Create a Cloudflare account (or log in) → https://dash.cloudflare.com
- [x] R2 → **Create bucket** — name: `inspiration-media` (region: automatic)
- [x] R2 → **Manage R2 API Tokens** → Create API token
      - Permission: **Object Read & Write**, scoped to the `inspiration-media` bucket
      - Save the **Access Key ID** and **Secret Access Key** (shown once)
- [x] Enable public access for the bucket:
      - Easiest: bucket → Settings → **R2.dev subdomain** → Allow access
        (gives you a `https://pub-xxxx.r2.dev` URL — fine for development)
      - Later/production: connect a **custom domain** (e.g. `cdn.yoursite.com`)
        on the bucket so media is served through Cloudflare's CDN with caching
- [x] Put the values in `web/.env.local` (and later in `ingest/.env`):

```bash
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com   # sans .eu
S3_BUCKET=alessia-inspiration
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
CDN_BASE_URL=https://pub-xxxx.r2.dev        # or https://cdn.yoursite.com
```

- [x] Tell Claude it's done → the ingest CLI gets switched from local storage to R2
- [ ] **Vérifier les secrets GitHub** : ils ont été saisis avec les mêmes valeurs
      d'exemple que `ingest/.env`. Corriger `S3_BUCKET` en `alessia-inspiration`
      et retirer le `.eu` de `S3_ENDPOINT`, sinon l'encodage échouera en CI
      avec « The specified bucket does not exist ».

## Back-office — ✅ en place

Le portail vit sur `/admin`. Connexion par lien magique, envoi direct vers
R2, encodage sur un runner GitHub. Il reste à :

- [ ] Vérifier le domaine `mail.nexus-studio.ch` chez Resend (enregistrements
      DNS envoyés à Alessia). Tant qu'il ne l'est pas, Resend ne délivre qu'à
      l'adresse propriétaire du compte : Alessia ne recevra pas son lien.
      Une fois vérifié, passer `AUTH_EMAIL_FROM` à `noreply@mail.nexus-studio.ch`.
- [ ] Reporter dans **Vercel** les variables du back-office : `AUTH_SECRET`,
      `ADMIN_EMAILS`, `AUTH_EMAIL_FROM`, `GITHUB_DISPATCH_TOKEN`, et les
      `S3_*` + `CDN_BASE_URL` (le site n'en avait pas besoin jusqu'ici, il ne
      lisait que des URLs déjà en base). Sans elles, l'envoi échoue en
      production alors qu'il fonctionne en local.

## Later (not blocking anything yet)

- [ ] Buy/choose the domain for the site
- [ ] Create a Vercel account for deployment (Phase 7)
- [ ] `brew install ffmpeg` if not already installed (needed for video ingestion)
