"use server";

import { getMarkgitClient } from "@/lib/markgit-client";

export async function getWallet() {
  const client = await getMarkgitClient();
  return client.getWallet();
}

export async function fundWallet(amountUsd: string) {
  const client = await getMarkgitClient();
  return client.fundWallet({ amountUsd });
}

export async function createCheckoutSession(amountUsd: number, successUrl: string, cancelUrl: string) {
  const client = await getMarkgitClient();
  return client.createCheckoutSession({ amountUsd, successUrl, cancelUrl });
}

export async function getLedger() {
  const client = await getMarkgitClient();
  return client.getLedger();
}
