import { neon, neonConfig } from "@neondatabase/serverless";
import { Agent, fetch as undiciFetch } from "undici";
import type { Brand, Item, ItemsPage, ProjectType } from "./types";

// Force IPv4: this machine has no IPv6 route and Node's dual-stack
// auto-selection hangs on Neon's endpoints instead of falling back.
// Harmless in production (IPv4 works everywhere).
const ipv4Agent = new Agent({ connect: { family: 4 } });
neonConfig.fetchFunction = (url: string, init: Record<string, unknown>) =>
  undiciFetch(url, { ...init, dispatcher: ipv4Agent });

const sql = neon(process.env.DATABASE_URL!);

type GetItemsOptions = {
  limit?: number;
  cursor?: string | null; // created_at of the last item on the previous page
  tag?: string | null;
  type?: "image" | "video" | null;
};

export async function getItems({
  limit = 30,
  cursor = null,
  tag = null,
  type = null,
}: GetItemsOptions = {}): Promise<ItemsPage> {
  // Fetch one extra row to know whether there is a next page.
  // status is not a filter the caller may relax: everything reachable from
  // the public site goes through here, so a draft or an unpublished item can
  // never leak by passing an unexpected argument.
  const rows = (await sql`
    select * from items
    where status = 'published'
      and (${cursor}::timestamptz is null or created_at < ${cursor})
      and (${tag}::text is null or ${tag} = any(tags))
      and (${type}::text is null or type = ${type})
    order by created_at desc
    limit ${limit + 1}
  `) as Item[];

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  // The driver returns timestamptz as a JS Date; normalize the cursor to ISO
  // so it survives URL round-trips and casts cleanly back to timestamptz.
  const nextCursor = hasMore
    ? new Date(items[items.length - 1].created_at).toISOString()
    : null;
  return { items, nextCursor };
}

// Same rule for the single-item page: an unpublished item must 404 rather
// than stay reachable by anyone who kept its URL.
export async function getItem(id: string): Promise<Item | null> {
  const rows = (await sql`
    select * from items where id = ${id} and status = 'published'
  `) as Item[];
  return rows[0] ?? null;
}

export async function addSubscriber(email: string, source: string | null) {
  await sql`
    insert into subscribers (email, source)
    values (${email}, ${source})
    on conflict (email) do nothing
  `;
}

// --- back-office ----------------------------------------------------------

// Magic links: single-use, short-lived, and only the hash is stored.
export async function saveMagicToken(
  hash: string,
  email: string,
  expiresAt: Date
) {
  await sql`
    insert into auth_tokens (token_hash, email, expires_at)
    values (${hash}, ${email}, ${expiresAt.toISOString()})
  `;
}

// Marks the token used and returns the address it was issued to, or null if
// it never existed, already expired, or was already consumed. The update is
// what makes it single-use: a second click on the same link finds used_at
// already set and gets nothing back.
export async function consumeMagicToken(hash: string): Promise<string | null> {
  const rows = (await sql`
    update auth_tokens
       set used_at = now()
     where token_hash = ${hash}
       and used_at is null
       and expires_at > now()
    returning email
  `) as { email: string }[];
  return rows[0]?.email ?? null;
}

// Housekeeping, called on each link request: the table is a queue, not a log.
export async function purgeExpiredTokens() {
  await sql`delete from auth_tokens where expires_at < now() - interval '1 day'`;
}

// --- marques --------------------------------------------------------------

export async function getBrands(): Promise<Brand[]> {
  return (await sql`select * from brands order by name`) as Brand[];
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // « Café » et « Cafe » donnent le même slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Alessia peut choisir une marque existante ou en saisir une nouvelle. Le
// rapprochement se fait sur le slug, pas sur le libellé : « Pop Mart »,
// « pop mart » et « POP MART » retombent donc sur la même ligne au lieu d'en
// créer trois.
export async function findOrCreateBrand(name: string): Promise<Brand> {
  const slug = slugify(name);
  if (!slug) throw new Error("Nom de marque vide");

  const existing = (await sql`select * from brands where slug = ${slug}`) as Brand[];
  if (existing[0]) return existing[0];

  const rows = (await sql`
    insert into brands (name, slug) values (${name.trim()}, ${slug})
    on conflict (slug) do update set slug = excluded.slug
    returning *
  `) as Brand[];
  return rows[0];
}

// --- items côté back-office ----------------------------------------------

type NewItem = {
  id: string;
  type: "image" | "video";
  title: string | null;
  description: string | null;
  projectType: ProjectType | null;
  brandId: string | null;
  sourceKey: string;
};

// La ligne naît en « processing » : elle existe, elle est visible dans le
// tableau d'administration, mais la galerie publique l'ignore. Les dimensions
// sont à 0 jusqu'à ce que le runner ait mesuré le fichier encodé — c'est lui
// qui connaît la vraie taille, rotation appliquée.
export async function createProcessingItem(item: NewItem) {
  await sql`
    insert into items
      (id, type, title, description, tags, project_type, brand_id,
       source_key, status, width, height)
    values
      (${item.id}, ${item.type}, ${item.title}, ${item.description}, ${[]},
       ${item.projectType}, ${item.brandId}, ${item.sourceKey},
       'processing', 0, 0)
  `;
}

export async function getAdminItems(): Promise<Item[]> {
  return (await sql`
    select * from items order by updated_at desc, created_at desc
  `) as Item[];
}
