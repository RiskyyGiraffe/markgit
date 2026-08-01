import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { AppTopbar } from "@/components/app-topbar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  if (!cookieStore.get("markgit-api-key")) redirect("/api/provision");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppTopbar user={session.user} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
