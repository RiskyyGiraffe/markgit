import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { approveDeviceAuthorization } from "@/actions/device-authorization";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function CliLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; linked?: string; error?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const params = await searchParams;
  if (!session) {
    const next = `/cli/link${params.code ? `?code=${encodeURIComponent(params.code)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const code = params.code?.trim().toUpperCase() ?? "";
  const linked = params.linked === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{linked ? "CLI linked" : "Link your CLI"}</CardTitle>
          <CardDescription>
            {linked
              ? "Your terminal can now access the registry, wallet balance, and paid tool calls."
              : `Authorize the CLI for ${session.user.email}.`}
          </CardDescription>
        </CardHeader>
        {linked ? (
          <CardContent className="text-sm text-muted-foreground">
            You can close this window and return to your terminal.
          </CardContent>
        ) : (
          <form action={approveDeviceAuthorization}>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="code">Code from your terminal</Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={code}
                  placeholder="ABCD-2345"
                  autoComplete="one-time-code"
                  required
                />
              </div>
              {params.error && (
                <p className="text-sm text-destructive">
                  That code is invalid, expired, or was already used. Start login again in your terminal.
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">Authorize CLI</Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </main>
  );
}
