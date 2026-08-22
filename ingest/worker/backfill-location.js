#!/usr/bin/env node
// Fills in where each item was shot, for content imported before locations
// were read.
//
// Two independent steps, deliberately runnable on their own:
//   1. coordinates — read from the local source files, matched to their row by
//      the same sha256 that already prevents duplicate imports. Nothing is
//      re-downloaded and nothing is re-encoded.
//   2. city — reverse-geocoded from those coordinates. A network call against
//      a rate-limited public service, which is why it isn't part of an import.
//
// Usage:
//   node worker/backfill-location.js <dossier des sources>   # les deux étapes
//   node worker/backfill-location.js --cities-only           # étape 2 seule

import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import { env } from "../lib/env.js";
import { MEDIA_EXT } from "../lib/pipeline.js";
import { readLocation } from "../lib/geo.js";
import { reverseGeocode } from "../lib/geocode.js";
import { itemsAwaitingCity, setCity, setLocationByImportKey } from "../lib/db.js";

const argv = process.argv.slice(2);
const citiesOnly = argv.includes("--cities-only");
const roots = argv.filter((a) => !a.startsWith("--"));

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}
if (!citiesOnly && roots.length === 0) {
  console.error(
    "Usage : node worker/backfill-location.js <dossier> | --cities-only"
  );
  process.exit(1);
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (MEDIA_EXT.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

// --- étape 1 : coordonnées ------------------------------------------------

if (!citiesOnly) {
  const files = [];
  for (const root of roots) await walk(root, files);
  console.log(`→ ${files.length} fichier(s) à examiner`);

  let updated = 0;
  let withoutGps = 0;
  let unknown = 0;

  for (const [i, file] of files.entries()) {
    if (i % 50 === 0 && i > 0) console.log(`  ${i}/${files.length}…`);
    const location = await readLocation(file);
    if (!location) {
      withoutGps++;
      continue;
    }
    const matched = await setLocationByImportKey(
      `sha256:${await sha256(file)}`,
      location.latitude,
      location.longitude
    );
    if (matched) updated++;
    else unknown++; // jamais importé, ou déjà localisé
  }

  console.log(
    `✓ coordonnées — ${updated} ligne(s) renseignée(s), ${withoutGps} fichier(s) sans GPS, ` +
      `${unknown} sans ligne correspondante ou déjà localisé(s)`
  );
}

// --- étape 2 : villes -----------------------------------------------------

const pending = await itemsAwaitingCity();
console.log(`\n→ ${pending.length} ligne(s) à géocoder`);

const seen = new Map();
let named = 0;

for (const row of pending) {
  const key = `${row.latitude.toFixed(3)},${row.longitude.toFixed(3)}`;
  if (!seen.has(key)) {
    const place = await reverseGeocode(row.latitude, row.longitude);
    seen.set(key, place);
    if (place) console.log(`  ${key} → ${place.city} (${place.country})`);
  }
  const place = seen.get(key);
  if (!place) continue;
  await setCity(row.id, place.city, place.country);
  named++;
}

console.log(
  `✓ villes — ${named} ligne(s) nommée(s), ${seen.size} lieu(x) distinct(s) interrogé(s)`
);
