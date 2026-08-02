import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getProduct } from "@/actions/marketplace";
import { getQuicklist } from "@/actions/quicklist";
import { getReviewState } from "@/actions/reviews";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductExecuteForm } from "@/components/product-execute-form";
import { QuicklistControl } from "@/components/quicklist-control";
import { ReviewControl } from "@/components/review-control";
import { ToolLogo } from "@/components/tool-logo";

function routeFor(kind: string, slug: string) {
  return `/${kind === "tool" ? "tools" : kind === "harness" ? "harnesses" : `${kind}s`}/${slug}`;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, quicklist, reviewState] = await Promise.all([getProduct(id), getQuicklist(), getReviewState(id)]);
  const quicklistEntry = quicklist.entries.find((entry) => entry.tool.id === product.id);
  const configuration = product.kind === "harness" ? product.harnessConfig : product.kind === "mcp" ? product.mcpConfig : product.kind === "skill" ? product.skillConfig : product.executionConfig;

  return <div className="space-y-7">
    <Link href="/marketplace" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Marketplace</Link>
    <section className="flex flex-col justify-between gap-6 border-b pb-7 md:flex-row md:items-start"><div className="flex gap-4"><ToolLogo name={product.name} logoUrl={product.logoUrl} category={product.category} tags={product.tags} size="lg" /><div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="capitalize">{product.kind === "harness" ? "custom loop" : product.kind}</Badge><Badge variant="outline">{product.status}</Badge></div><h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.045em]">{product.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{product.description}</p></div></div><div className="flex shrink-0 flex-col items-end gap-3"><Badge variant="outline">{Number(product.pricePerCallUsd) === 0 ? "Free" : `$${Number(product.pricePerCallUsd).toFixed(4)} / call`}</Badge>{product.kind === "tool" ? <QuicklistControl slug={product.slug} initialMode={quicklistEntry?.authorization.mode} versionCurrent={quicklistEntry?.authorization.versionCurrent} /> : null}<Link href={routeFor(product.kind, product.slug)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Public page <ExternalLink className="size-3" /></Link></div></section>

    <div className={`grid gap-6 ${product.kind === "tool" ? "lg:grid-cols-2" : ""}`}>
      {product.kind === "tool" ? <Card><CardHeader><CardTitle>Execute</CardTitle><CardDescription>Calls made here become Markgit-observed review evidence.</CardDescription></CardHeader><CardContent><ProductExecuteForm productId={product.id} inputSchema={product.inputSchema as Record<string, unknown> | null} executionConfig={product.executionConfig as Record<string, unknown> | null} buyerCredentialConfigured={product.buyerCredentialConfigured} policy={product.policy} manifestDigest={product.manifestDigest} /></CardContent></Card> : null}
      <Card><CardHeader><CardTitle>{product.kind === "tool" ? "Input and return schemas" : "Indexed configuration"}</CardTitle><CardDescription>These fields are included in full-document and semantic search.</CardDescription></CardHeader><CardContent><pre className="max-h-[560px] overflow-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify({ inputSchema: product.inputSchema, outputSchema: product.outputSchema, configuration, sourceMetadata: product.sourceMetadata }, null, 2)}</pre></CardContent></Card>
    </div>
    <ReviewControl identifier={product.id} initialEligibility={reviewState.eligibility} initialReviews={reviewState.reviews} />
  </div>;
}
