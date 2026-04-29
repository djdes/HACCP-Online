import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { JournalsProgressClient } from "./journals-progress-client";

export const dynamic = "force-dynamic";

export default async function JournalsProgressPage() {
  const session = await requireAuth();
  if (
    !hasCapability(session.user, "tasks.verify") &&
    !hasCapability(session.user, "admin.full")
  ) {
    redirect("/mini/today");
  }
  return <JournalsProgressClient />;
}
