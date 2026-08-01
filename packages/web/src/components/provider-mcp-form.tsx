"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createProviderMcp } from "@/actions/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProviderMcpForm() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"streamable_http" | "sse">("streamable_http");
  const [authMode, setAuthMode] = useState<"none" | "oauth2" | "user_supplied">("none");
  const [tools, setTools] = useState('[\n  { "name": "search", "description": "Search public sources" }\n]');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const parsedTools = JSON.parse(tools) as Array<{ name: string; description?: string }>;
      await createProviderMcp({
        schemaVersion: "1",
        kind: "mcp",
        name,
        slug,
        description,
        server: { url, transport, auth: { mode: authMode } },
        features: { tools: parsedTools, resources: false, prompts: false },
      });
      toast.success("MCP server created as a draft");
      setName(""); setSlug(""); setDescription(""); setUrl("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create MCP server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Publish an MCP server</CardTitle><CardDescription>List a remote MCP endpoint. Clients connect directly; Markgit never proxies its traffic.</CardDescription></CardHeader>
      <CardContent><form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Name</Label><Input required value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-2"><Label>Slug</Label><Input required value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="my-mcp-server" /></div></div>
        <div className="space-y-2"><Label>Description</Label><Textarea required value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="space-y-2"><Label>Remote server URL</Label><Input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://mcp.example.com/mcp" /></div>
        <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Transport</Label><select className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={transport} onChange={(event) => setTransport(event.target.value as typeof transport)}><option value="streamable_http">Streamable HTTP</option><option value="sse">SSE</option></select></div><div className="space-y-2"><Label>Authentication</Label><select className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={authMode} onChange={(event) => setAuthMode(event.target.value as typeof authMode)}><option value="none">None</option><option value="oauth2">OAuth 2</option><option value="user_supplied">User-supplied credential</option></select></div></div>
        <div className="space-y-2"><Label>Declared tools JSON</Label><Textarea className="min-h-32 font-mono text-xs" value={tools} onChange={(event) => setTools(event.target.value)} /></div>
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Create MCP draft</Button>
      </form></CardContent>
    </Card>
  );
}
