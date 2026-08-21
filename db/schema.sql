-- Schéma complet de la base Nexus Studio.
-- Pour initialiser une nouvelle base Neon : ouvre le SQL Editor du projet,
-- colle tout ce fichier, clique "Run". C'est tout.
-- (Extrait de la base de production le 2026-07-14.)

-- Les marques (Nike, Pop Mart…). Table plutôt que champ texte libre :
-- « Pop mart », « popmart » et « Pop Mart » resteraient sinon trois marques
-- distinctes, et renommer une marque se répercute ici en un seul endroit.
create table brands (
  id         text primary key default gen_random_uuid()::text,
  name       text not null unique,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- La galerie : une ligne par visuel (image ou vidéo).
-- Remplie par le back-office, ou par les scripts d'import en masse (ingest/).
create table items (
  id             text primary key,
  type           text not null,               -- 'image' | 'video'
  title          text,
  description    text,
  tags           text[] not null default '{}',
  category       text,
  source_url     text,                        -- lien d'origine, optionnel
  creator        text,                        -- auteur du design
  width          integer not null,
  height         integer not null,
  dominant_color text,                        -- ex. '#3b82f6'
  blur_data_url  text,                        -- mini placeholder base64
  poster_url     text,                        -- vignette vidéo
  image_base     text,                        -- base CDN des variantes image
  video_url      text,
  video_av1_url  text,
  import_key     text,                        -- ex. 'drive:<id>' — anti-doublon, jamais affiché

  -- Colonnes pilotées par le back-office (web/app/admin).
  status         text not null default 'published',  -- voir la contrainte plus bas
  error          text,                        -- message d'échec du transcodage
  project_type   text,                        -- 'popup' | 'store'
  brand_id       text references brands(id) on delete set null,
  source_key     text,                        -- l'original intact sur R2, pour ré-encoder
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  -- 'processing' : le runner GitHub Actions encode. 'failed' : voir error.
  -- 'unpublished' : masqué du site, réversible — à distinguer d'une suppression.
  constraint items_status_check
    check (status in ('processing','published','unpublished','failed')),
  constraint items_project_type_check
    check (project_type is null or project_type in ('popup','store'))
);

create index items_created_at_idx on items (created_at desc);
create index items_tags_idx on items using gin (tags);
create unique index items_import_key_idx on items (import_key) where import_key is not null;
create index items_status_created_idx on items (status, created_at desc);
create index items_brand_idx on items (brand_id);

-- Liens de connexion à usage unique du back-office. Seul le hash du jeton
-- est stocké : une copie de la base ne permet donc pas de fabriquer une
-- connexion. used_at est ce qui rend le lien non rejouable.
create table auth_tokens (
  token_hash text primary key,
  email      text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_expires_idx on auth_tokens (expires_at);

-- Les inscrits à la newsletter (email unique, source = 'modal' | 'button').
create table subscribers (
  email      text primary key,
  source     text,
  created_at timestamptz not null default now()
);

-- ============================================================
--  Migrations — à jouer sur une base DÉJÀ existante.
--  Sans effet sur une base fraîchement créée avec ce fichier.
-- ============================================================

-- 2026-08-21 — clé d'import (anti-doublon des imports en masse, ex. Drive).
alter table items add column if not exists import_key text;
create unique index if not exists items_import_key_idx
  on items (import_key) where import_key is not null;

-- 2026-08-22 — back-office : statut de publication, marque, type de projet.
create table if not exists brands (
  id         text primary key default gen_random_uuid()::text,
  name       text not null unique,
  slug       text not null unique,
  created_at timestamptz not null default now()
);
alter table items add column if not exists status text not null default 'published';
alter table items add column if not exists error text;
alter table items add column if not exists project_type text;
alter table items add column if not exists brand_id text references brands(id) on delete set null;
alter table items add column if not exists source_key text;
alter table items add column if not exists updated_at timestamptz not null default now();
alter table items add constraint items_status_check
  check (status in ('processing','published','unpublished','failed'));
alter table items add constraint items_project_type_check
  check (project_type is null or project_type in ('popup','store'));
create index if not exists items_status_created_idx on items (status, created_at desc);
create index if not exists items_brand_idx on items (brand_id);

-- 2026-08-22 — connexion par lien magique.
create table if not exists auth_tokens (
  token_hash text primary key,
  email      text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_tokens_expires_idx on auth_tokens (expires_at);
