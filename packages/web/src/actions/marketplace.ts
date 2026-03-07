"use server";

import { getToltyClient } from "@/lib/tolty-client";

export async function searchProducts(query?: string) {
  const client = await getToltyClient();
  if (query && query.trim()) {
    return client.search({ query: query.trim() });
  }
  return client.listProducts();
}

export async function getProduct(id: string) {
  const client = await getToltyClient();
  return client.getProduct(id);
}
