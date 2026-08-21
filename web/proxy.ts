import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic gate only. This runs on every matching request, including link
// prefetches, so it does nothing but look for the cookie — no signature
// check, no database. Whether the session is genuine is decided in lib/dal.ts,
// next to the data, which every admin page and route goes through.
//
// (This file is named proxy.ts, not middleware.ts: the middleware convention
// is deprecated in this version of Next.)
export function proxy(request: NextRequest) {
  const hasCookie = request.cookies.has("nx_session");
  if (hasCookie) return NextResponse.next();

  const login = new URL("/login", request.url);
  // Where they were headed, so the login can send them back afterwards.
  login.searchParams.set("suite", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: "/admin/:path*",
};
