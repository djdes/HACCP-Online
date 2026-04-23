import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions-server";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const perms = await getUserPermissions(session.user.id);
  const isManagerLike =
    session.user.isRoot === true ||
    perms.has("dashboard.view") ||
    perms.has("staff.manage");

  return NextResponse.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      isRoot: session.user.isRoot,
    },
    mode: isManagerLike ? "manager" : perms.has("journals.fill") ? "staff" : "readonly",
    permissions: Array.from(perms),
  });
}
