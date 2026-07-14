// One-shot backfill: pushes every subscriber already in Neon into the
// Resend audience. Run it once after setting RESEND_API_KEY and
// RESEND_AUDIENCE_ID, so contacts collected before the integration
// aren't missing from the list. Safe to re-run (Resend dedups by email).
//
//   node --env-file=.env.local scripts/sync-resend.mjs
import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, RESEND_API_KEY, RESEND_AUDIENCE_ID } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL missing");
if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
  throw new Error("Set RESEND_API_KEY and RESEND_AUDIENCE_ID in .env.local first");
}

const sql = neon(DATABASE_URL);
const rows = await sql`select email from subscribers order by created_at`;
console.log(`${rows.length} subscriber(s) in Neon — syncing to Resend…`);

let ok = 0;
for (const { email } of rows) {
  const res = await fetch(
    `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    }
  );
  if (res.ok || res.status === 409) {
    ok++;
  } else {
    console.error(`✗ ${email}: ${res.status} ${await res.text()}`);
  }
  // Resend rate limit is 2 req/s — stay under it.
  await new Promise((r) => setTimeout(r, 600));
}
console.log(`Done: ${ok}/${rows.length} synced.`);
