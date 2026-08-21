-- Schéma complet de la base Motioon.
-- Pour initialiser une nouvelle base Neon : ouvre le SQL Editor du projet,
-- colle tout ce fichier, clique "Run". C'est tout.
-- (Extrait de la base de production le 2026-07-14.)

-- La galerie : une ligne par visuel (image ou vidéo).
-- Remplie automatiquement par le robot d'import Notion (ingest/).
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
  created_at     timestamptz not null default now()
);

create index items_created_at_idx on items (created_at desc);
create index items_tags_idx on items using gin (tags);
create unique index items_import_key_idx on items (import_key) where import_key is not null;

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
