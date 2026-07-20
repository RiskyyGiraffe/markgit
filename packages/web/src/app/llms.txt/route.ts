import { markgitApiUrl } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(`${markgitApiUrl}/v1/registry/llms.txt`, { cache: "no-store" });
  if (!response.ok) {
    return new Response("# Markgit\n\nThe live tool registry is temporarily unavailable.\n", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(await response.text(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
