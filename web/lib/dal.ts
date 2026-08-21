import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionToken, sessionCookie, type Session } from "@/lib/auth";

// The Data Access Layer. proxy.ts only performs an optimistic redirect — it
// runs on every prefetch and cannot be the thing that protects data. This is
// where the session is actually verified, and every admin page and every
// /api/admin route must go through it.
//
// cache() memoizes the check for the duration of a single render pass, so a
// page and its components can each call it without re-verifying.
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  return readSessionToken(store.get(sessionCookie.name)?.value);
});

// For pages: sends the visitor to the login screen when there's no session.
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// For route handlers: an API must answer 401, never redirect — a fetch()
// following a redirect to an HTML login page produces a confusing parse
// error on the client instead of a clear status.
export async function requireApiSession(): Promise<
  { session: Session; response: null } | { session: null; response: Response }
> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: Response.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }
  return { session, response: null };
}
