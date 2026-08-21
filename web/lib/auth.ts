import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

// Sessions are a signed cookie rather than a row in the database: two people
// use this back-office, and a stateless token keeps the request path free of
// a database round-trip. Revoking everyone means rotating AUTH_SECRET.
const SESSION_COOKIE = "nx_session";
const SESSION_DAYS = 30;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET manquant");
  return value;
}

// Who may enter at all. An address absent from this list can request a magic
// link all day long and never receive one.
export function isAllowed(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(normalizeEmail(email));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type Session = { email: string; exp: number };

export function createSessionToken(email: string): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({ email: normalizeEmail(email), exp } satisfies Session)
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Returns null for anything that isn't a currently-valid token: wrong shape,
// bad signature, expired, or an address since removed from ADMIN_EMAILS.
export function readSessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  // Length has to match before timingSafeEqual, which throws otherwise.
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  let session: Session;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (typeof session.email !== "string" || typeof session.exp !== "number") {
    return null;
  }
  if (session.exp < Date.now()) return null;
  // Checked again on every request, so removing an address from ADMIN_EMAILS
  // logs that person out immediately instead of at the end of their 30 days.
  if (!isAllowed(session.email)) return null;

  return session;
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  },
};

// --- magic links ----------------------------------------------------------

// The raw token travels in the email link; only its hash is stored, so a
// leaked database backup can't be turned into a working login.
export function createMagicToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const MAGIC_TOKEN_TTL_MINUTES = 15;
