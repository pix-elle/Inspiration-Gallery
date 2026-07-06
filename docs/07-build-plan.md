# Build Plan — Step by Step

Layout: **one persistent left sidebar** (a few placeholder links) + a main content
area holding the gallery. Components organized with **atomic design** so each piece
is small and easy to manage.

---

## Atomic design mapping

Atomic design has five levels. Here's how *our* components fall into them so you
always know where a new file goes.

```
atoms/       → smallest UI primitives, no business logic
  ├── Logo.tsx
  ├── NavLink.tsx          # one sidebar link (icon + label)
  ├── Tag.tsx              # a single tag pill
  ├── Skeleton.tsx         # loading block
  └── Spinner.tsx

molecules/   → small groups of atoms that do one thing
  ├── ImageTile.tsx        # <picture> + srcset + blur-up
  ├── VideoTile.tsx        # poster + play-on-view
  ├── TagList.tsx          # row of <Tag>
  └── SidebarNav.tsx       # list of <NavLink>

organisms/   → self-contained sections built from molecules/atoms
  ├── Sidebar.tsx          # Logo + SidebarNav (the whole left column)
  ├── Gallery.tsx          # virtualized masonry + infinite scroll
  └── GalleryItem.tsx      # one tile → routes to Image/VideoTile

templates/   → page skeletons (layout, no real data)
  └── AppShell.tsx         # sidebar + main content slot

pages/       → real routes with data (Next.js app/ dir)
  ├── app/page.tsx         # home gallery
  └── app/item/[id]/page.tsx
```

**Rule of thumb:** if a component talks to the network or knows about routes, it's a
**page**; if it composes a whole section, it's an **organism**; if it's a couple of
atoms glued together, it's a **molecule**; if it can't be broken down further, it's
an **atom**.

---

## The layout — sidebar + content

```
┌───────────────┬──────────────────────────────────────────┐
│               │                                          │
│   Sidebar     │              Gallery                     │
│  (organism)   │            (organism)                    │
│               │                                          │
│  • Logo       │   [virtualized masonry grid of tiles]    │
│  • Discover   │                                          │
│  • Images     │                                          │
│  • Videos     │                                          │
│  • Saved      │                                          │
│               │                                          │
└───────────────┴──────────────────────────────────────────┘
     AppShell (template) wraps both
```

`AppShell` lives in Next.js `app/layout.tsx` so the sidebar renders once and
**persists across navigation** (it never re-mounts when you open an item).

### Placeholder sidebar links
```
Discover   → "/"
Images     → "/?type=image"   (wire up later)
Videos     → "/?type=video"   (wire up later)
Saved      → "/saved"         (placeholder page for now)
About      → "/about"         (placeholder)
```
Ship them as dead/placeholder links first; wire filtering in a later phase.

---

## Phase 0 — Project setup  *(~30 min)*
- [ ] `npx create-next-app@latest inspiration --typescript --tailwind --app`
- [ ] Create the atomic folders: `components/atoms`, `/molecules`, `/organisms`, `/templates`
- [ ] Add `.env.local` (DB + storage keys — see docs 03/05)
- [ ] Commit the empty skeleton

**Done when:** the default Next.js app runs at `localhost:3000`.

---

## Phase 1 — The shell & sidebar  *(build the frame first, no data)*
- [ ] `atoms/Logo.tsx`, `atoms/NavLink.tsx`
- [ ] `molecules/SidebarNav.tsx` (maps an array of placeholder links → `NavLink`)
- [ ] `organisms/Sidebar.tsx` (Logo + SidebarNav, fixed left column)
- [ ] `templates/AppShell.tsx` (sidebar + `{children}` main area)
- [ ] Wire `AppShell` into `app/layout.tsx`
- [ ] Home page shows placeholder grid blocks (`atoms/Skeleton`)

**Done when:** sidebar is visible on every route, links navigate (even to empty
pages), layout is responsive (sidebar collapses/hides on mobile).

---

## Phase 2 — Database & one seeded item  *(prove the data path)*
- [ ] Create Neon Postgres project
- [ ] Run the `items` schema (docs 03)
- [ ] Manually insert **one** fake row (hardcoded CDN URLs are fine)
- [ ] `lib/queries.ts` → `getItems()` + `getItem()`
- [ ] Home page server-fetches that one item and logs it

**Done when:** `getItems()` returns your seeded row in the page.

---

## Phase 3 — Ingest CLI  *(get real media in)*
- [ ] Build `ingest/` per docs 05 (upload → image → video → placeholder → db)
- [ ] Set up Cloudflare R2 bucket + public CDN domain
- [ ] Ingest one real image and one real video
- [ ] Confirm variants exist in R2 and rows exist in Postgres

**Done when:** `node ingest.js ./clip.mov --title …` puts a working item live.

---

## Phase 4 — The gallery  *(the core UX)*
- [ ] `molecules/ImageTile.tsx` (picture + srcset + blur-up)
- [ ] `molecules/VideoTile.tsx` + `useInViewVideo.ts`
- [ ] `organisms/GalleryItem.tsx` (aspect ratio + dominant color)
- [ ] `organisms/Gallery.tsx` (virtualized masonry, `initialItems` from SSR)
- [ ] Home page renders `Gallery` with real items

**Done when:** the grid shows real tiles, images blur-up, videos play on view,
no layout shift.

---

## Phase 5 — Infinite scroll & detail page
- [ ] `app/api/items/route.ts` (cursor pagination)
- [ ] `Gallery` `endReached` → fetch next page
- [ ] `app/item/[id]/page.tsx` (full-res + OG tags)
- [ ] Ingest ~20+ items to test scrolling

**Done when:** scrolling loads more pages smoothly and clicking a tile opens detail.

---

## Phase 6 — Filtering & polish
- [ ] `atoms/Tag.tsx`, `molecules/TagList.tsx`
- [ ] Wire sidebar `Images`/`Videos` links → `?type=` filter (server-side SQL)
- [ ] Tag filtering via `?tag=`
- [ ] Loading/empty states, 404, favicon, meta/OG
- [ ] Lighthouse pass (target: LCP < 2.5s, CLS < 0.1)

**Done when:** filters work server-side and Lighthouse is green.

---

## Phase 7 — Deploy
- [ ] Push to GitHub
- [ ] Deploy to Vercel, set env vars
- [ ] Point CDN domain, verify cache headers (`immutable` on media)
- [ ] Smoke test on mobile

**Done when:** the live site loads fast on a phone and repeat visits hit the edge cache.

---

## Later (not for v1)
- Saved/likes (introduces first visitor auth) → docs 03 "optional additions"
- Search (Postgres FT → Meilisearch if it grows)
- Managed video (Bunny Stream/Mux) if you add long adaptive-bitrate videos
- Admin UI (only if you outgrow the CLI)

---

## Suggested order to actually write code
1. **Shell + sidebar** (Phase 1) — you see the app take shape immediately.
2. **DB + one seeded row** (Phase 2) — cheap way to prove the data path before the CLI.
3. **Ingest CLI** (Phase 3) — now real media flows in.
4. **Gallery** (Phase 4–5) — the payoff.
5. **Filter + polish + deploy** (Phase 6–7).

Build the **frame before the content**: a working sidebar + empty grid is more
motivating and de-risks layout early, before you touch media or the database.
