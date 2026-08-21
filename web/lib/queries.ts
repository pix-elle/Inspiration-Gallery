import { neon, neonConfig } from "@neondatabase/serverless";
import { Agent, fetch as undiciFetch } from "undici";
import type { Item, ItemsPage } from "./types";

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
