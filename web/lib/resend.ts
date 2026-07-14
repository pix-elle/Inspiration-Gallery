// Push a subscriber into the Resend audience (https://resend.com/audiences).
// Neon stays the source of truth; this mirrors new signups into Resend so
// the newsletter list is always ready to send. No-op until both env vars
// are set (RESEND_API_KEY + RESEND_AUDIENCE_ID), so dev and prod keep
// working before the Resend account is wired up.
export async function addToResendAudience(
  email: string
): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) return { ok: true, skipped: true };

  const res = await fetch(
    `https://api.resend.com/audiences/${audienceId}/contacts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    }
  );

  // 409 = contact already in the audience — same silent dedup as the DB.
  if (!res.ok && res.status !== 409) {
    console.error(
      `Resend contact create failed (${res.status}): ${await res.text()}`
    );
    return { ok: false };
  }
  return { ok: true };
}
