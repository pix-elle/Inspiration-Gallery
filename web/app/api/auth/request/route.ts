import {
  createMagicToken,
  isAllowed,
  normalizeEmail,
  MAGIC_TOKEN_TTL_MINUTES,
} from "@/lib/auth";
import { saveMagicToken, purgeExpiredTokens } from "@/lib/queries";
import { sendMagicLink } from "@/lib/auth-email";

export async function POST(req: Request) {
  let email: string;
  try {
    const body = await req.json();
    email = normalizeEmail(String(body.email ?? ""));
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }

  if (!email.includes("@")) {
    return Response.json({ error: "Adresse email invalide" }, { status: 400 });
  }

  // Deliberately the same answer whether or not the address is allowed. A
  // different message here would turn this endpoint into a way of testing who
  // has access to the back-office.
  const answer = Response.json({ ok: true });

  if (!isAllowed(email)) return answer;

  const { token, hash } = createMagicToken();
  const expiresAt = new Date(Date.now() + MAGIC_TOKEN_TTL_MINUTES * 60 * 1000);
  await saveMagicToken(hash, email, expiresAt);
  await purgeExpiredTokens();

  const url = new URL(req.url);
  const link = `${url.origin}/api/auth/callback?token=${token}`;
  await sendMagicLink(email, link);

  return answer;
}
