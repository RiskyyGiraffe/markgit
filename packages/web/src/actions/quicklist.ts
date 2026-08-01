"use server";

import type { AuthorizationMode } from "@markgit/sdk";
import { revalidatePath } from "next/cache";
import { getMarkgitClient } from "@/lib/markgit-client";

export async function getQuicklist() {
  return (await getMarkgitClient()).getQuicklist();
}

export async function saveQuicklistTool(identifier: string, authorizationMode: AuthorizationMode) {
  const result = await (await getMarkgitClient()).saveQuicklistTool(identifier, authorizationMode);
  revalidatePath("/dashboard");
  revalidatePath("/marketplace");
  return result;
}

export async function removeQuicklistTool(identifier: string) {
  const result = await (await getMarkgitClient()).removeQuicklistTool(identifier);
  revalidatePath("/dashboard");
  revalidatePath("/marketplace");
  return result;
}
