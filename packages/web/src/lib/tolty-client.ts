import { cookies } from "next/headers";
import { ToltyClient } from "@tolty/sdk";
import { decrypt } from "./cookie-crypto";

const COOKIE_NAME = "tolty-api-key";

export async function getToltyClient(): Promise<ToltyClient> {
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(COOKIE_NAME)?.value;

  if (!encrypted) {
    throw new Error("No API key cookie found — user not authenticated");
  }

  const rawKey = decrypt(encrypted);
  return new ToltyClient({
    apiKey: rawKey,
    baseUrl: process.env.TOLTY_API_URL ?? "http://localhost:3000",
  });
}
