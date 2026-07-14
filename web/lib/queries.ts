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
  const rows = (await sql`
    select * from items
    where (${cursor}::timestamptz is null or created_at < ${cursor})
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

export async function getItem(id: string): Promise<Item | null> {
  const rows = (await sql`select * from items where id = ${id}`) as Item[];
  return rows[0] ?? null;
}

export async function addSubscriber(email: string, source: string | null) {
  await sql`
    insert into subscribers (email, source)
    values (${email}, ${source})
    on conflict (email) do nothing
  `;
}
