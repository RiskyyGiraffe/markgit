"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  EarningsSummary,
  Payout,
  Product,
  Provider,
  ProviderImportRun,
  StripeStatusResponse,
} from "@tolty/sdk";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";

import {
  connectStripeAccount,
  createProviderImport,
  publishProviderImport,
  registerProvider,
  reviewProviderImport,
  syncStripeStatus as syncStripeStatusAction,
  testProviderImport,
} from "@/actions/provider";
import { ProviderProductForm } from "@/components/provider-product-form";
import { ProviderProductsTable } from "@/components/provider-products-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type DraftState = {
  name: string;
  slug: string;
  description: string;
  category: string;
  pricePerCallUsd: string;
  tags: string;
  inputSchema: string;
  outputSchema: string;
  executionConfig: string;
};

function parseJsonField<T>(value: string, label: string): T | undefined {
  if (!value.trim()) return undefined;

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

function formatJson(value: unknown) {
  if (!value) return "";
  return JSON.stringify(value, null, 2);
}

function buildDraftState(run: ProviderImportRun | null): DraftState {
  const draft = (run?.generatedDraft ?? {}) as Record<string, unknown>;
  return {
    name: typeof draft.name === "string" ? draft.name : "",
    slug: typeof draft.slug === "string" ? draft.slug : "",
    description: typeof draft.description === "string" ? draft.description : "",
    category: typeof draft.category === "string" ? draft.category : "",
    pricePerCallUsd:
      typeof draft.pricePerCallUsd === "string" ? draft.pricePerCallUsd : "0.2500",
    tags: Array.isArray(draft.tags) ? draft.tags.join(", ") : "imported, api",
    inputSchema: formatJson(draft.inputSchema),
    outputSchema: formatJson(draft.outputSchema),
    executionConfig: formatJson(draft.executionConfig),
  };
}

export function ProviderOnboardingWizard({
  provider,
  stripeStatus,
  latestImportRun,
  earnings,
  payoutHistory,
  products,
}: {
  provider: Provider | null;
  stripeStatus: StripeStatusResponse | null;
  latestImportRun: ProviderImportRun | null;
  earnings: EarningsSummary | null;
  payoutHistory: Payout[];
  products: Product[];
}) {
  const router = useRouter();
  const [providerLoading, setProviderLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [providerName, setProviderName] = useState(provider?.name ?? "");
  const [providerDescription, setProviderDescription] = useState(provider?.description ?? "");
  const [providerWebsiteUrl, setProviderWebsiteUrl] = useState(provider?.websiteUrl ?? "");

  const [docsUrl, setDocsUrl] = useState(latestImportRun?.docsUrl ?? "");
  const [baseUrl, setBaseUrl] = useState(latestImportRun?.baseUrl ?? "");
  const [authMode, setAuthMode] = useState<"none" | "provider_managed" | "buyer_supplied">(
    ((((latestImportRun?.generatedDraft as any)?.executionConfig?.auth?.mode as
      | "none"
      | "provider_managed"
      | "buyer_supplied"
      | undefined) ??
      "none") as "none" | "provider_managed" | "buyer_supplied")
  );
  const [currentRun, setCurrentRun] = useState<ProviderImportRun | null>(latestImportRun);
  const [draftState, setDraftState] = useState<DraftState>(buildDraftState(latestImportRun));
  const [testInput, setTestInput] = useState("{}");
  const [testCredentialValue, setTestCredentialValue] = useState("");
  const [providerCredentialValue, setProviderCredentialValue] = useState("");

  useEffect(() => {
    setCurrentRun(latestImportRun);
    setDraftState(buildDraftState(latestImportRun));
    setDocsUrl(latestImportRun?.docsUrl ?? "");
    setBaseUrl(latestImportRun?.baseUrl ?? "");
    setAuthMode(
      ((((latestImportRun?.generatedDraft as any)?.executionConfig?.auth?.mode as
        | "none"
        | "provider_managed"
        | "buyer_supplied"
        | undefined) ??
        "none") as "none" | "provider_managed" | "buyer_supplied")
    );
  }, [latestImportRun]);

  const currentAuthConfig = useMemo(() => {
    try {
      return (
        parseJsonField<Record<string, any>>(draftState.executionConfig, "Execution config")
          ?.auth ?? null
      );
    } catch {
      return null;
    }
  }, [draftState.executionConfig]);

  const testResult = currentRun?.lastTestResponse as
    | { success?: boolean; output?: Record<string, unknown>; error?: string }
    | null;

  const handleProviderCreate = async () => {
    setProviderLoading(true);
    try {
      await registerProvider({
        name: providerName,
        description: providerDescription || undefined,
        websiteUrl: providerWebsiteUrl || undefined,
      });
      toast.success("Provider account created");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create provider");
    } finally {
      setProviderLoading(false);
    }
  };

  const handleStartImport = async () => {
    setImportLoading(true);
    try {
      const run = await createProviderImport({ docsUrl, baseUrl, authMode });
      setCurrentRun(run);
      setDraftState(buildDraftState(run));
      toast.success("Import draft created");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import docs");
    } finally {
      setImportLoading(false);
    }
  };

  const handleReviewSave = async () => {
    if (!currentRun) return;
    setReviewLoading(true);
    try {
      const run = await reviewProviderImport(currentRun.id, {
        name: draftState.name,
        slug: draftState.slug,
        description: draftState.description || undefined,
        category: draftState.category || undefined,
        pricePerCallUsd: draftState.pricePerCallUsd,
        tags: draftState.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        inputSchema: parseJsonField<Record<string, unknown>>(
          draftState.inputSchema,
          "Input schema"
        ),
        outputSchema: parseJsonField<Record<string, unknown>>(
          draftState.outputSchema,
          "Output schema"
        ),
        executionConfig: parseJsonField<Record<string, unknown>>(
          draftState.executionConfig,
          "Execution config"
        ),
      });
      setCurrentRun(run);
      toast.success("Draft saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleTest = async () => {
    if (!currentRun) return;
    setTestLoading(true);
    try {
      const credential =
        authMode === "none"
          ? undefined
          : currentAuthConfig
            ? {
                authType: currentAuthConfig.type,
                location: currentAuthConfig.location,
                name: currentAuthConfig.name,
                scheme: currentAuthConfig.scheme,
                value: testCredentialValue,
              }
            : undefined;

      const result = await testProviderImport(currentRun.id, {
        input: parseJsonField<Record<string, unknown>>(testInput, "Test input") ?? {},
        credential:
          authMode === "none"
            ? undefined
            : credential?.value
              ? credential
              : undefined,
      });

      setCurrentRun(result.run);
      if (result.result.success) {
        toast.success("Test call passed");
      } else {
        toast.error(result.result.errorMessage ?? "Test call failed");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to test import");
    } finally {
      setTestLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!currentRun) return;
    setPublishLoading(true);
    try {
      const result = await publishProviderImport(currentRun.id, {
        draft: {
          name: draftState.name,
          slug: draftState.slug,
          description: draftState.description || undefined,
          category: draftState.category || undefined,
          pricePerCallUsd: draftState.pricePerCallUsd,
          tags: draftState.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          inputSchema: parseJsonField<Record<string, unknown>>(
            draftState.inputSchema,
            "Input schema"
          ),
          outputSchema: parseJsonField<Record<string, unknown>>(
            draftState.outputSchema,
            "Output schema"
          ),
          executionConfig: parseJsonField<Record<string, unknown>>(
            draftState.executionConfig,
            "Execution config"
          ),
        },
        providerCredential:
          authMode === "provider_managed" && currentAuthConfig && providerCredentialValue.trim()
            ? {
                authType: currentAuthConfig.type,
                location: currentAuthConfig.location,
                name: currentAuthConfig.name,
                scheme: currentAuthConfig.scheme,
                value: providerCredentialValue.trim(),
              }
            : undefined,
      });
      setCurrentRun(result.run);
      toast.success(`Published ${result.product.name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish product");
    } finally {
      setPublishLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    setStripeLoading(true);
    try {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(
        /\/$/,
        ""
      );
      const { url } = await connectStripeAccount(
        `${appUrl}/provider`,
        `${appUrl}/provider?onboarding=complete`
      );
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Stripe onboarding");
      setStripeLoading(false);
    }
  };

  const handleSyncStripe = async () => {
    setStripeLoading(true);
    try {
      await syncStripeStatusAction();
      toast.success("Stripe status refreshed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync Stripe");
    } finally {
      setStripeLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Provider</h1>
        <p className="text-muted-foreground">
          Import an API from docs, test it, publish it, and monitor payouts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Provider profile</CardTitle>
          <CardDescription>
            Create the provider identity that will own imported products.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wizard-provider-name">Name</Label>
              <Input
                id="wizard-provider-name"
                value={providerName}
                onChange={(event) => setProviderName(event.target.value)}
                disabled={Boolean(provider)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wizard-provider-website">Website</Label>
              <Input
                id="wizard-provider-website"
                value={providerWebsiteUrl}
                onChange={(event) => setProviderWebsiteUrl(event.target.value)}
                placeholder="https://example.com"
                disabled={Boolean(provider)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-provider-description">Description</Label>
            <Textarea
              id="wizard-provider-description"
              value={providerDescription}
              onChange={(event) => setProviderDescription(event.target.value)}
              disabled={Boolean(provider)}
            />
          </div>
          {provider ? (
            <Alert>
              <AlertTitle>Provider ready</AlertTitle>
              <AlertDescription>
                {provider.name} is registered and can import products.
              </AlertDescription>
            </Alert>
          ) : (
            <Button
              type="button"
              onClick={handleProviderCreate}
              disabled={providerLoading || !providerName.trim()}
            >
              {providerLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create provider
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Import source</CardTitle>
          <CardDescription>
            Point markgit at your docs and endpoint. It will generate the initial draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wizard-docs-url">Docs URL</Label>
              <Input
                id="wizard-docs-url"
                value={docsUrl}
                onChange={(event) => setDocsUrl(event.target.value)}
                placeholder="https://example.com/openapi.json"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wizard-base-url">Base endpoint</Label>
              <Input
                id="wizard-base-url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Auth mode</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "none", label: "No auth" },
                { value: "provider_managed", label: "Provider-hosted secret" },
                { value: "buyer_supplied", label: "Buyer supplies key" },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={authMode === option.value ? "default" : "outline"}
                  onClick={() =>
                    setAuthMode(
                      option.value as "none" | "provider_managed" | "buyer_supplied"
                    )
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            onClick={handleStartImport}
            disabled={importLoading || !provider || !docsUrl.trim() || !baseUrl.trim()}
          >
            {importLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Import docs
          </Button>

          {currentRun && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{currentRun.status}</Badge>
              <span>Source: {currentRun.sourceType}</span>
              <span>Confidence: {Math.round(Number(currentRun.confidence) * 100)}%</span>
            </div>
          )}
          {currentRun?.warnings?.length ? (
            <Alert>
              <AlertTitle>Import warnings</AlertTitle>
              <AlertDescription>{currentRun.warnings.join(" ")}</AlertDescription>
            </Alert>
          ) : null}
          {currentRun?.errors?.length ? (
            <Alert variant="destructive">
              <AlertTitle>Import errors</AlertTitle>
              <AlertDescription>{currentRun.errors.join(" ")}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {currentRun && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Payout setup</CardTitle>
              <CardDescription>
                Connect Stripe and keep the provider account status in sync.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={stripeStatus?.status === "active" ? "default" : "secondary"}>
                  {stripeStatus?.status ?? "not_connected"}
                </Badge>
                {stripeStatus && (
                  <span className="text-sm text-muted-foreground">
                    Platform available ${parseFloat(stripeStatus.platformAvailableUsd).toFixed(2)} |
                    pending ${parseFloat(stripeStatus.platformPendingUsd).toFixed(2)}
                  </span>
                )}
              </div>
              {stripeStatus?.currentlyDue?.length ? (
                <Alert variant="destructive">
                  <AlertTitle>Stripe still needs information</AlertTitle>
                  <AlertDescription>
                    {stripeStatus.currentlyDue.join(", ")}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleConnectStripe} disabled={stripeLoading || !provider}>
                  {stripeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {stripeStatus?.accountId ? "Re-open Stripe onboarding" : "Connect Stripe"}
                </Button>
                <Button type="button" variant="outline" onClick={handleSyncStripe} disabled={stripeLoading || !provider}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Stripe status
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 4: Review generated draft</CardTitle>
              <CardDescription>
                Edit only what the importer got wrong. Happy path should be ready as-is.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={draftState.name}
                    onChange={(event) =>
                      setDraftState((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={draftState.slug}
                    onChange={(event) =>
                      setDraftState((prev) => ({ ...prev, slug: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={draftState.category}
                    onChange={(event) =>
                      setDraftState((prev) => ({ ...prev, category: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price per call</Label>
                  <Input
                    value={draftState.pricePerCallUsd}
                    onChange={(event) =>
                      setDraftState((prev) => ({
                        ...prev,
                        pricePerCallUsd: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input
                    value={draftState.tags}
                    onChange={(event) =>
                      setDraftState((prev) => ({ ...prev, tags: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={draftState.description}
                  onChange={(event) =>
                    setDraftState((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Input schema JSON</Label>
                <Textarea
                  className="min-h-[140px] font-mono text-xs"
                  value={draftState.inputSchema}
                  onChange={(event) =>
                    setDraftState((prev) => ({ ...prev, inputSchema: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Output schema JSON</Label>
                <Textarea
                  className="min-h-[120px] font-mono text-xs"
                  value={draftState.outputSchema}
                  onChange={(event) =>
                    setDraftState((prev) => ({ ...prev, outputSchema: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Execution config JSON</Label>
                <Textarea
                  className="min-h-[220px] font-mono text-xs"
                  value={draftState.executionConfig}
                  onChange={(event) =>
                    setDraftState((prev) => ({ ...prev, executionConfig: event.target.value }))
                  }
                />
              </div>
              <Button type="button" onClick={handleReviewSave} disabled={reviewLoading}>
                {reviewLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save draft
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 5: Test call</CardTitle>
              <CardDescription>
                Run one live test before publishing this product.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Test input JSON</Label>
                <Textarea
                  className="min-h-[120px] font-mono text-xs"
                  value={testInput}
                  onChange={(event) => setTestInput(event.target.value)}
                />
              </div>
              {authMode !== "none" && currentAuthConfig && (
                <div className="space-y-2">
                  <Label>
                    {authMode === "provider_managed"
                      ? "Temporary provider credential for test"
                      : "Temporary buyer credential for test"}
                  </Label>
                  <Input
                    type="password"
                    value={testCredentialValue}
                    onChange={(event) => setTestCredentialValue(event.target.value)}
                    placeholder={`Value for ${currentAuthConfig.name}`}
                  />
                </div>
              )}
              <Button type="button" onClick={handleTest} disabled={testLoading}>
                {testLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run test call
              </Button>
              {testResult ? (
                <Alert variant={testResult.success ? "default" : "destructive"}>
                  <AlertTitle>
                    {testResult.success ? "Test passed" : "Test failed"}
                  </AlertTitle>
                  <AlertDescription>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                      {JSON.stringify(
                        testResult.success ? testResult.output : testResult.error,
                        null,
                        2
                      )}
                    </pre>
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 6: Publish</CardTitle>
              <CardDescription>
                Publish the reviewed draft to the marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {authMode === "provider_managed" && currentAuthConfig && (
                <div className="space-y-2">
                  <Label>Stored provider credential</Label>
                  <Input
                    type="password"
                    value={providerCredentialValue}
                    onChange={(event) => setProviderCredentialValue(event.target.value)}
                    placeholder={`Value for ${currentAuthConfig.name}`}
                  />
                  <p className="text-sm text-muted-foreground">
                    This is encrypted and stored server-side only.
                  </p>
                </div>
              )}
              <Button type="button" onClick={handlePublish} disabled={publishLoading}>
                {publishLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish product
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {provider && earnings && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Gross</CardDescription>
                <CardTitle className="text-2xl">
                  ${parseFloat(earnings.totalGross).toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Platform Fees</CardDescription>
                <CardTitle className="text-2xl">
                  ${parseFloat(earnings.totalFees).toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Payout</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  ${parseFloat(earnings.unpaid).toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Paid Out</CardDescription>
                <CardTitle className="text-2xl">
                  ${parseFloat(earnings.paidOut).toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payout history</CardTitle>
              <CardDescription>
                Failed payouts remain visible until the platform balance settles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payoutHistory.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">No payouts yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Failure</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutHistory.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>${parseFloat(payout.amountUsd).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payout.status === "completed"
                                ? "default"
                                : payout.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {payout.failureMessage ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(payout.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Products</CardTitle>
                <CardDescription>
                  Imported products land here. Manual setup is still available.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                {showAdvanced ? "Hide manual setup" : "Advanced manual setup"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {showAdvanced ? <ProviderProductForm /> : null}
              <ProviderProductsTable products={products} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
