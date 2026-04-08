import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();

  if (!roles.includes(session.user.role)) {
    redirect("/dashboard");
  }

  return session;
}
