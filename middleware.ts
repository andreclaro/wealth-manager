import { auth } from "@/lib/auth-edge";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname === "/login";
  const isAppRoute = nextUrl.pathname.startsWith("/app");

  // If user is logged in and trying to access /login, redirect to /app
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/app", nextUrl));
  }

  // If user is not logged in and trying to access /app, redirect to /login
  if (!isLoggedIn && isAppRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/login"],
};
