"use client";

import { useState } from "react";
import { deleteBuyerCredential, executeProduct, saveBuyerCredential } from "@/actions/purchases";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

interface InputSchema {
  type?: string;
  properties?: Record<
    string,
    {
      type?: string;
      description?: string;
    }
  >;
  required?: string[];
}

interface ExecutionAuthSchema {
  mode?: "none" | "provider_managed" | "buyer_supplied";
  type?: "none" | "bearer" | "api_key" | "basic";
  location?: "header" | "query" | "body";
  name?: string;
  scheme?: string;
}

export function ProductExecuteForm({
  productId,
  inputSchema,
  executionConfig,
  buyerCredentialConfigured,
}: {
  productId: string;
  inputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
  buyerCredentialConfigured?: boolean;
}) {
  const schema = inputSchema as InputSchema | null;
  const auth = (
    executionConfig as { auth?: ExecutionAuthSchema } | null
  )?.auth;
  const properties = schema?.properties ?? {};
  const required = schema?.required ?? [];
  const fields = Object.entries(properties);
  const needsBuyerCredential = auth?.mode === "buyer_supplied";

  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [credentialConfigured, setCredentialConfigured] = useState(
    buyerCredentialConfigured ?? false
  );
  const [credentialValue, setCredentialValue] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSaveCredential = async () => {
    if (!auth?.type || auth.type === "none" || !auth.location || !auth.name) {
      toast.error("This product is missing a valid credential configuration");
      return;
    }

    if (!credentialValue.trim()) {
      toast.error("Credential value is required");
      return;
    }

    setCredentialLoading(true);
    try {
      await saveBuyerCredential(productId, {
        authType: auth.type,
        location: auth.location,
        name: auth.name,
        value: credentialValue.trim(),
      });
      setCredentialConfigured(true);
      setCredentialValue("");
      toast.success("Credential saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save credential");
    } finally {
      setCredentialLoading(false);
    }
  };

  const handleDeleteCredential = async () => {
    setCredentialLoading(true);
    try {
      await deleteBuyerCredential(productId);
      setCredentialConfigured(false);
      toast.success("Credential removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove credential");
    } finally {
      setCredentialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Convert string values to appropriate types
      const input: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(values)) {
        const prop = properties[key];
        if (prop?.type === "number" || prop?.type === "integer") {
          input[key] = parseFloat(val);
        } else if (prop?.type === "boolean") {
          input[key] = val === "true";
        } else {
          input[key] = val;
        }
      }

      const res = await executeProduct(productId, input);
      setResult(res.execution.output);
      if (res.execution.status === "failed") {
        setError(res.execution.errorMessage ?? "Execution failed");
      } else {
        toast.success("API executed successfully");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Execution failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {needsBuyerCredential && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Buyer credential required</p>
            <p className="text-sm text-muted-foreground">
              Save your own credential for this product before executing it.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Auth type</Label>
              <Input value={auth?.type ?? ""} disabled />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={auth?.location ?? ""} disabled />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={auth?.name ?? ""} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer-credential-value">
              {credentialConfigured ? "Replace credential" : "Credential value"}
            </Label>
            <Input
              id="buyer-credential-value"
              type="password"
              value={credentialValue}
              onChange={(event) => setCredentialValue(event.target.value)}
              placeholder="Paste the API key or token to send upstream"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={credentialLoading}
              onClick={handleSaveCredential}
            >
              {credentialLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {credentialConfigured ? "Update credential" : "Save credential"}
            </Button>
            {credentialConfigured && (
              <Button
                type="button"
                variant="outline"
                disabled={credentialLoading}
                onClick={handleDeleteCredential}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No input parameters required
          </p>
        ) : (
          fields.map(([key, prop]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>
                {key}
                {required.includes(key) && (
                  <Badge variant="destructive" className="ml-2 text-[10px]">
                    required
                  </Badge>
                )}
              </Label>
              {prop.description && (
                <p className="text-xs text-muted-foreground">
                  {prop.description}
                </p>
              )}
              <Input
                id={key}
                type={
                  prop.type === "number" || prop.type === "integer"
                    ? "number"
                    : "text"
                }
                step={prop.type === "number" ? "any" : undefined}
                required={required.includes(key)}
                value={values[key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={`Enter ${key}${prop.type ? ` (${prop.type})` : ""}`}
              />
            </div>
          ))
        )}
        <Button
          type="submit"
          disabled={loading || (needsBuyerCredential && !credentialConfigured)}
          className="w-full"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Execute API
        </Button>
        {needsBuyerCredential && !credentialConfigured && (
          <p className="text-sm text-muted-foreground">
            Save a credential above before executing this product.
          </p>
        )}
      </form>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Error</p>
          <p className="text-sm text-destructive/80">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Result</p>
          <pre className="overflow-auto rounded-lg bg-muted p-4 text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
