"use server";

import { revalidatePath } from "next/cache";
import { getMarkgitClient } from "@/lib/markgit-client";

export async function getReviewState(identifier: string) {
  const client = await getMarkgitClient();
  const [eligibility, reviews] = await Promise.all([
    client.getReviewEligibility(identifier),
    client.getReviews(identifier),
  ]);
  return { eligibility, reviews };
}

export async function attestReviewUsage(identifier: string, agentName: string, evidenceSummary?: string) {
  const result = await (await getMarkgitClient()).reportUsage(identifier, {
    interactionId: crypto.randomUUID(),
    agentName,
    evidenceSummary,
  });
  revalidatePath(`/marketplace/${identifier}`);
  return result;
}

export async function saveReview(identifier: string, input: { helpful: boolean; agentName: string; title?: string; body?: string }) {
  const result = await (await getMarkgitClient()).review(identifier, input);
  revalidatePath(`/marketplace/${identifier}`);
  return result;
}
