"use client";

import { useState } from "react";
import { executeProduct } from "@/actions/purchases";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

export function ProductExecuteForm({
  productId,
  inputSchema,
}: {
  productId: string;
  inputSchema: Record<string, unknown> | null;
}) {
  const schema = inputSchema as InputSchema | null;
  const properties = schema?.properties ?? {};
  const required = schema?.required ?? [];
  const fields = Object.entries(properties);

  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <Button type="submit" disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Execute API
        </Button>
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
