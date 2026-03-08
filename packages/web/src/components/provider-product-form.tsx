"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createProviderProduct } from "@/actions/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const sampleInputSchema = `{
  "type": "object",
  "required": ["message"],
  "properties": {
    "message": { "type": "string", "description": "Message to send upstream" }
  }
}`;

const sampleExecutionConfig = `{
  "type": "http_rest",
  "method": "GET",
  "baseUrl": "https://postman-echo.com/get",
  "timeoutMs": 10000,
  "paramMapping": {
    "message": { "target": "query", "param": "message" }
  }
}`;

function parseJsonField(value: string, label: string) {
  if (!value.trim()) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

export function ProviderProductForm() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [pricePerCallUsd, setPricePerCallUsd] = useState("0.2500");
  const [tags, setTags] = useState("tools,api");
  const [inputSchema, setInputSchema] = useState(sampleInputSchema);
  const [outputSchema, setOutputSchema] = useState("");
  const [executionConfig, setExecutionConfig] = useState(sampleExecutionConfig);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      await createProviderProduct({
        name,
        slug,
        description: description || undefined,
        category: category || undefined,
        pricePerCallUsd,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        inputSchema: parseJsonField(inputSchema, "Input schema"),
        outputSchema: parseJsonField(outputSchema, "Output schema"),
        executionConfig: parseJsonField(executionConfig, "Execution config"),
      });
      toast.success("Product created as draft");
      setName("");
      setSlug("");
      setDescription("");
      setCategory("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Product</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-slug">Slug</Label>
              <Input
                id="product-slug"
                required
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="my-api-product"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <Input
                id="product-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Price Per Call (USD)</Label>
              <Input
                id="product-price"
                required
                value={pricePerCallUsd}
                onChange={(event) => setPricePerCallUsd(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-tags">Tags</Label>
              <Input
                id="product-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="tools,api"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-input-schema">Input Schema JSON</Label>
            <Textarea
              id="product-input-schema"
              className="min-h-[140px] font-mono text-xs"
              value={inputSchema}
              onChange={(event) => setInputSchema(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-output-schema">Output Schema JSON</Label>
            <Textarea
              id="product-output-schema"
              className="min-h-[100px] font-mono text-xs"
              value={outputSchema}
              onChange={(event) => setOutputSchema(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-execution-config">Execution Config JSON</Label>
            <Textarea
              id="product-execution-config"
              className="min-h-[160px] font-mono text-xs"
              value={executionConfig}
              onChange={(event) => setExecutionConfig(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Draft Product
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
