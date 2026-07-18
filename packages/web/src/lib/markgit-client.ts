import { cookies } from "next/headers";
import { MarkgitClient } from "@markgit/sdk";
import { decrypt } from "./cookie-crypto";

const COOKIE_NAME = "markgit-api-key";

export async function getMarkgitClient(): Promise<MarkgitClient> {
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(COOKIE_NAME)?.value;

  if (!encrypted) {
    throw new Error("No API key cookie found — user not authenticated");
  }

  const rawKey = decrypt(encrypted);
  return new MarkgitClient({
    apiKey: rawKey,
    baseUrl: process.env.MARKGIT_API_URL ?? "http://localhost:3000",
  });
}
