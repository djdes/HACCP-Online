import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { hasCapability } from "@/lib/permission-presets";
import { ControlBoardClient } from "./control-board-client";

export const dynamic = "force-dynamic";

export default async function ControlBoardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (
    !hasCapability(session.user, "tasks.verify") &&
    !hasCapability(session.user, "admin.full")
  ) {
    redirect("/mini/today");
  }
  return <ControlBoardClient />;
}
