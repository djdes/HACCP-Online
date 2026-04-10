import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasAnyUserRole } from "@/lib/user-roles";

export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();

  if (!hasAnyUserRole(session.user.role, roles)) {
    redirect("/dashboard");
  }

  return session;
}
