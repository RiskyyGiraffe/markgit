import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { ensureToltyUserAndKey } from "@/actions/auth-bridge";
import { encrypt } from "@/lib/cookie-crypto";

const COOKIE_NAME = "tolty-api-key";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { rawKey } = await ensureToltyUserAndKey(
    session.user.email,
    session.user.name
  );

  // Redirect to the originally requested page (or dashboard)
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("next") || "/dashboard";

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set(COOKIE_NAME, encrypt(rawKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
