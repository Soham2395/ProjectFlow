import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // Allow Next internal and static assets
  if (pathname.startsWith("/_next") || pathname.match(/\.(.*)$/)) {
    return NextResponse.next();
  }
  const secureCookieName = "__Secure-next-auth.session-token";
  const defaultCookieName = "next-auth.session-token";
  const sessionCookie = req.cookies.get(secureCookieName)?.value || req.cookies.get(defaultCookieName)?.value;
  const isAuth = Boolean(sessionCookie);

  // Redirect to login if not authenticated
  if (!isAuth) {
    let from = pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }
    return NextResponse.redirect(
      new URL(`/auth/signin?callbackUrl=${encodeURIComponent(from)}`, origin)
    );
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on protected routes
  matcher: [
    "/dashboard/:path*",
    "/project/:path*",
    "/analytics/:path*",
  ],
};