import { getSession } from "@/lib/dal";

// Lets the public site ask "am I signed in?" without becoming dynamic. If the
// layout checked the session server-side, every visitor would pay for a
// personalised render; this way the page stays cached and only the browser of
// a signed-in admin makes this one extra call.
//
// It reveals nothing: the answer is an affordance, not a permission. Saving
// goes through /api/admin/settings, which verifies the session for real.
export async function GET() {
  const session = await getSession();
  return Response.json({ email: session?.email ?? null });
}
