import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // If the markgit API key cookie is missing, redirect to the provision
  // route handler which can set the cookie and redirect back.
  const cookieStore = await cookies();
  if (!cookieStore.get("tolty-api-key")) {
    redirect("/api/provision");
  }

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset className="bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.035),transparent_26%),linear-gradient(180deg,#f7f7f3_0%,#f1f1ec_100%)] transition-colors dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,#09090b_0%,#121216_100%)]">
        <AppTopbar user={session.user} />
        <main className="flex-1 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
