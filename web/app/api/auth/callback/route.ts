import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  hashToken,
  isAllowed,
  sessionCookie,
} from "@/lib/auth";
import { consumeMagicToken } from "@/lib/queries";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) redirect("/login?erreur=lien");

  // Consuming marks the token used in the same statement that reads it, so a
  // link that gets forwarded or re-clicked is already spent.
  const email = await consumeMagicToken(hashToken(token));
  if (!email) redirect("/login?erreur=expire");

  // The allowlist is checked again here: an address may have been removed
  // between the moment the link was sent and the moment it was clicked.
  if (!isAllowed(email)) redirect("/login?erreur=lien");

  const store = await cookies();
  store.set(sessionCookie.name, createSessionToken(email), sessionCookie.options);

  redirect("/admin");
}
