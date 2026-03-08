"use server";

import { getToltyClient } from "@/lib/tolty-client";

export async function executeProduct(
  productId: string,
  input: Record<string, unknown>
) {
  const client = await getToltyClient();

  // 1. Create quote
  const quote = await client.createQuote({ productId });

  // 2. Create purchase + execute
  const result = await client.createPurchase({
    productId,
    quoteId: quote.id,
    input,
  });

  return result;
}

export async function listPurchases() {
  const client = await getToltyClient();
  return client.listPurchases();
}

export async function listExecutions() {
  const client = await getToltyClient();
  return client.listExecutions();
}

export async function saveBuyerCredential(
  productId: string,
  input: {
    authType: "bearer" | "api_key" | "basic";
    location: "header" | "query" | "body";
    name: string;
    value: string;
  }
) {
  const client = await getToltyClient();
  return client.setSelfCredential(productId, input);
}

export async function deleteBuyerCredential(productId: string) {
  const client = await getToltyClient();
  return client.deleteSelfCredential(productId);
}
