import { addSubscriber } from "@/lib/queries";
import { addToResendAudience } from "@/lib/resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  // Duplicate signups resolve silently (on conflict do nothing): the user
  // just sees success — no email-existence oracle, no awkward error.
  await addSubscriber(email, body.source?.slice(0, 50) ?? null);

  // Mirror into the Resend audience. Neon is the source of truth, so a
  // Resend failure never blocks the signup — it's logged and recoverable
  // (missing contacts can be re-synced from the subscribers table).
  await addToResendAudience(email);

  return Response.json({ ok: true });
}
