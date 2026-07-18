"use server";

import { getMarkgitClient } from "@/lib/markgit-client";

export async function searchProducts(query?: string) {
  const client = await getMarkgitClient();
  if (query && query.trim()) {
    return client.search({ query: query.trim() });
  }
  return client.listProducts();
}

export async function getProduct(id: string) {
  const client = await getMarkgitClient();
  return client.getProduct(id);
}
