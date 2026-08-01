import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/api/auth",
  "/tools",
  "/harnesses",
  "/mcps",
  "/skills",
  "/leaderboard",
  "/docs",
  "/llms.txt",
  "/.well-known/llms.txt",
];

function getSessionToken(request: NextRequest) {
  return (
    request.cookies.get("__Secure-better-auth.session_token")?.value ??
    request.cookies.get("better-auth.session_token")?.value
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = getSessionToken(request);

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
