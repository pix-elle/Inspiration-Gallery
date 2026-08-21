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

// Returns true if the item existed. Media files (R2 / web/public/media)
// are left behind on purpose — cheap, and the id is never reused.
export async function deleteItem(id) {
  const rows = await sql`delete from items where id = ${id} returning id`;
  return rows.length > 0;
}

export async function insertItem(row) {
  await sql`
    insert into items
      (id, type, title, description, tags, category, creator, source_url,
       width, height, dominant_color, blur_data_url,
       poster_url, image_base, video_url, video_av1_url, import_key)
    values
      (${row.id}, ${row.type}, ${row.title}, ${row.description}, ${row.tags},
       ${row.category}, ${row.creator}, ${row.sourceUrl},
       ${row.width}, ${row.height}, ${row.dominantColor}, ${row.blurDataUrl},
       ${row.posterUrl}, ${row.imageBase}, ${row.videoUrl}, ${row.videoAv1Url},
       ${row.importKey ?? null})
  `;
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
