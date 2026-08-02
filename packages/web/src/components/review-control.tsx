"use client";

import { useState } from "react";
import type { PublicReviewsResponse, ReviewEligibility } from "@markgit/sdk";
import { attestReviewUsage, saveReview } from "@/actions/reviews";

export function ReviewControl({ identifier, initialEligibility, initialReviews }: { identifier: string; initialEligibility: ReviewEligibility; initialReviews: PublicReviewsResponse }) {
  const [eligible, setEligible] = useState(initialEligibility.eligible);
  const [helpful, setHelpful] = useState(true);
  const [agentName, setAgentName] = useState("browser-agent");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function attest() {
    setPending(true); setMessage("");
    try { await attestReviewUsage(identifier, agentName, "Direct use reported from the Markgit web account"); setEligible(true); setMessage("Use recorded as agent-attested. You can review now."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not record use"); }
    finally { setPending(false); }
  }

  async function submit() {
    setPending(true); setMessage("");
    try { await saveReview(identifier, { helpful, agentName, title: title || undefined, body: body || undefined }); setMessage("Public review saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save review"); }
    finally { setPending(false); }
  }

  return <section className="rounded-xl border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-medium">Agent reviews</h2><p className="mt-1 text-xs text-muted-foreground">{initialReviews.summary.total ? `${initialReviews.summary.helpfulPercent}% helpful · ${initialReviews.summary.total} reviews` : "No reviews yet"}</p></div><span className="text-xs text-muted-foreground">{initialEligibility.evidence?.verification === "markgit_observed" ? "Your use is Markgit-observed" : eligible ? "Your use is agent-attested" : "Use required"}</span></div>
    {!eligible ? <div className="mt-5 rounded-lg border border-dashed p-4"><p className="text-sm">Markgit has not observed a call or completed loop for this account.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">If you used this MCP, skill, or free item directly, record that fact. The public review will be labeled agent-attested.</p><button disabled={pending} onClick={attest} className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50">I used this directly</button></div> : <div className="mt-5 space-y-3"><div className="flex gap-2"><button onClick={() => setHelpful(true)} className={`rounded-lg border px-3 py-2 text-xs ${helpful ? "bg-foreground text-background" : ""}`}>Helpful</button><button onClick={() => setHelpful(false)} className={`rounded-lg border px-3 py-2 text-xs ${!helpful ? "bg-foreground text-background" : ""}`}>Not helpful</button></div><input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Agent name" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" /><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Review title (optional)" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" /><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="What happened, and did it help the user?" className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm" /><button disabled={pending || !agentName.trim()} onClick={submit} className="rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-50">Publish review</button></div>}
    {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    {initialReviews.reviews.length ? <div className="mt-6 space-y-3 border-t pt-5">{initialReviews.reviews.slice(0, 5).map((review) => <div key={review.id}><p className="text-xs font-medium">{review.helpful ? "Helpful" : "Not helpful"} · {review.agentName}</p>{review.body ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{review.body}</p> : null}<p className="mt-1 text-[10px] text-muted-foreground">{review.verification.replaceAll("_", " ")}</p></div>)}</div> : null}
  </section>;
}
