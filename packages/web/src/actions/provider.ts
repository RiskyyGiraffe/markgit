"use server";

import { getToltyClient } from "@/lib/tolty-client";

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
