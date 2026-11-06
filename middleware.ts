import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Built from the Prisma-free config: this only reads the session cookie.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = Boolean(req.auth);
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Public images skip the auth check: the /_next/image optimizer fetches
  // them internally without the visitor's cookies, so a redirect to /login
  // here breaks every next/image (and the favicon on the login page). The
  // push service worker is a public file too, which browsers re-check on
  // page loads.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|push-sw\\.js|.*\\.(?:png|jpe?g|gif|svg|webp|ico)$).*)",
  ],
};
