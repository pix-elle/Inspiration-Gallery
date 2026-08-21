import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookie } from "@/lib/auth";

// POST only: a GET would let any <img src="/api/auth/logout"> on any page
// sign the user out.
export async function POST() {
  const store = await cookies();
  store.delete(sessionCookie.name);
  redirect("/login");
}
