"use server";

import { and, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { deviceAuthorizations } from "@markgit/api/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMarkgitUser } from "@/actions/auth-bridge";

export async function approveDeviceAuthorization(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) redirect("/cli/link?error=missing-code");

  const { userId } = await ensureMarkgitUser(session.user.email, session.user.name);
  const [authorization] = await db
    .update(deviceAuthorizations)
    .set({
      status: "approved",
      userId,
      approvedAt: new Date(),
    })
    .where(and(
      eq(deviceAuthorizations.userCode, code),
      eq(deviceAuthorizations.status, "pending"),
      gt(deviceAuthorizations.expiresAt, new Date()),
    ))
    .returning({ id: deviceAuthorizations.id });

  if (!authorization) {
    redirect(`/cli/link?code=${encodeURIComponent(code)}&error=invalid-code`);
  }

  redirect(`/cli/link?code=${encodeURIComponent(code)}&linked=1`);
}
