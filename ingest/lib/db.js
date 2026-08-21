import { neon, neonConfig } from "@neondatabase/serverless";
import { Agent, fetch as undiciFetch } from "undici";
import { env } from "./env.js";

// Same IPv4 workaround as web/lib/queries.ts — this machine has no IPv6
// route and Node's dual-stack auto-selection hangs on Neon endpoints.
// (Port 5432 is also blocked here, hence the HTTP driver instead of pg.)
const ipv4Agent = new Agent({ connect: { family: 4 } });
neonConfig.fetchFunction = (url, init) =>
  undiciFetch(url, { ...init, dispatcher: ipv4Agent });

const sql = neon(env.DATABASE_URL);

export async function insertItem(row) {
  await sql`
    insert into items
      (id, type, title, description, tags, category, creator, source_url,
       width, height, dominant_color, blur_data_url,
       poster_url, image_base, video_url, video_av1_url, import_key,
       project_type, brand_id, status)
    values
      (${row.id}, ${row.type}, ${row.title}, ${row.description}, ${row.tags},
       ${row.category}, ${row.creator}, ${row.sourceUrl},
       ${row.width}, ${row.height}, ${row.dominantColor}, ${row.blurDataUrl},
       ${row.posterUrl}, ${row.imageBase}, ${row.videoUrl}, ${row.videoAv1Url},
       ${row.importKey ?? null},
       ${row.projectType ?? null}, ${row.brandId ?? null}, 'published')
  `;
}

// Même règle que le back-office : on rapproche sur le slug, pas sur le
// libellé, sinon « Pop Mart » et « pop mart » deviennent deux marques.
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function findOrCreateBrand(name) {
  const slug = slugify(name);
  if (!slug) return null;
  const found = await sql`select id from brands where slug = ${slug}`;
  if (found[0]) return found[0].id;
  const created = await sql`
    insert into brands (name, slug) values (${name.trim()}, ${slug})
    on conflict (slug) do update set slug = excluded.slug
    returning id
  `;
  return created[0].id;
}

// Which of these import keys are already in the gallery? Lets a bulk import
// be re-run safely — already-published files are skipped, not duplicated.
export async function existingImportKeys(keys) {
  if (keys.length === 0) return new Set();
  const rows = await sql`
    select import_key from items where import_key = any(${keys})
  `;
  return new Set(rows.map((r) => r.import_key));
}

// --- back-office ----------------------------------------------------------

// La ligne créée par le portail, telle que le runner la trouve.
export async function getItemForProcessing(id) {
  const rows = await sql`
    select id, type, source_key, status from items where id = ${id}
  `;
  return rows[0] ?? null;
}

// Fin de traitement : on remplit les colonnes média et on publie. Les
// dimensions viennent du fichier produit, jamais de la source (les téléphones
// filment en paysage avec un drapeau de rotation).
export async function publishProcessedItem(id, media) {
  await sql`
    update items set
      type           = ${media.type},
      width          = ${media.width},
      height         = ${media.height},
      dominant_color = ${media.dominantColor},
      blur_data_url  = ${media.blurDataUrl},
      poster_url     = ${media.posterUrl},
      image_base     = ${media.imageBase},
      video_url      = ${media.videoUrl},
      video_av1_url  = ${media.videoAv1Url},
      status         = 'published',
      error          = null,
      updated_at     = now()
    where id = ${id}
  `;
}

export async function failItem(id, message) {
  await sql`
    update items
       set status = 'failed', error = ${String(message).slice(0, 2000)},
           updated_at = now()
     where id = ${id}
  `;
}
