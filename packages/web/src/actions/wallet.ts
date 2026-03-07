"use server";

import { getToltyClient } from "@/lib/tolty-client";

export async function getWallet() {
  const client = await getToltyClient();
  return client.getWallet();
}

export async function fundWallet(amountUsd: string) {
  const client = await getToltyClient();
  return client.fundWallet({ amountUsd });
}

export async function createCheckoutSession(amountUsd: number, successUrl: string, cancelUrl: string) {
  const client = await getToltyClient();
  return client.createCheckoutSession({ amountUsd, successUrl, cancelUrl });
}

export async function getLedger() {
  const client = await getToltyClient();
  return client.getLedger();
}
