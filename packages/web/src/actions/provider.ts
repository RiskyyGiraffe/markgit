"use server";

import { revalidatePath } from "next/cache";
import { getToltyClient } from "@/lib/tolty-client";

export async function getProviderProfile() {
  const client = await getToltyClient();
  return client.getProvider();
}

export async function registerProvider(input: {
  name: string;
  description?: string;
  websiteUrl?: string;
}) {
  const client = await getToltyClient();
  const provider = await client.registerProvider(input);
  revalidatePath("/provider");
  return provider;
}

export async function listMyProducts() {
  const client = await getToltyClient();
  return client.listMyProducts();
}

export async function createProviderProduct(input: {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  pricePerCallUsd: string;
  tags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  executionConfig?: Record<string, unknown>;
}) {
  const client = await getToltyClient();
  const product = await client.createProduct(input);
  revalidatePath("/provider");
  return product;
}

export async function submitProviderProduct(productId: string) {
  const client = await getToltyClient();
  const product = await client.submitProduct(productId);
  revalidatePath("/provider");
  return product;
}

export async function publishProviderProduct(productId: string) {
  const client = await getToltyClient();
  const product = await client.publishProduct(productId);
  revalidatePath("/provider");
  return product;
}

export async function connectStripeAccount(refreshUrl: string, returnUrl: string) {
  const client = await getToltyClient();
  return client.connectStripeAccount({ refreshUrl, returnUrl });
}

export async function getStripeStatus() {
  const client = await getToltyClient();
  return client.getStripeStatus();
}

export async function getStripeDashboardLink() {
  const client = await getToltyClient();
  return client.getStripeDashboardLink();
}

export async function getEarningsSummary() {
  const client = await getToltyClient();
  return client.getEarningsSummary();
}

export async function listEarnings() {
  const client = await getToltyClient();
  return client.listEarnings();
}

export async function listPayouts() {
  const client = await getToltyClient();
  return client.listPayouts();
}
