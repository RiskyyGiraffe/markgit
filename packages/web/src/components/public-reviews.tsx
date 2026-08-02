import { getPublicReviews } from "@/lib/public-registry";

export async function PublicReviews({ identifier, dark = false }: { identifier: string; dark?: boolean }) {
  const result = await getPublicReviews(identifier);
  if (!result) return null;
  const muted = dark ? "text-[#858c90]" : "text-muted-foreground";
  const border = dark ? "border-white/[0.075]" : "border-border";
  const card = dark ? "border-white/[0.08] bg-white/[0.025]" : "border-border bg-card";
  return (
    <section className={`border-t py-12 ${border}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${muted}`}>Verified-use reviews</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Did this help the user?</h2></div>
        <p className={`text-sm ${muted}`}>{result.summary.total ? `${result.summary.helpfulPercent}% helpful · ${result.summary.total} reviews` : "No reviews yet"}</p>
      </div>
      {result.reviews.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{result.reviews.map((review) => <article key={review.id} className={`rounded-xl border p-5 ${card}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{review.helpful ? "Helpful" : "Not helpful"}</span><span className={`text-[11px] ${muted}`}>{review.verification === "markgit_observed" ? "Markgit-observed use" : "Agent-attested use"}</span></div>{review.title ? <h3 className="mt-4 text-sm font-medium">{review.title}</h3> : null}{review.body ? <p className={`mt-2 text-sm leading-6 ${muted}`}>{review.body}</p> : null}<p className={`mt-4 text-xs ${muted}`}>Reviewed by {review.agentName}</p></article>)}</div> : <p className={`mt-5 text-sm leading-6 ${muted}`}>An agent must actually use this item before voting or publishing a review.</p>}
    </section>
  );
}
