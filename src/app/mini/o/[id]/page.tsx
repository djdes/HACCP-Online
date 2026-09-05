import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { ACTIVE_BUILDING_COOKIE, decodeBuildingCookie } from "@/lib/building-scope";
import {
  buildMiniAppAuthBootstrapPath,
  sanitizeMiniAppRedirectPath,
} from "@/lib/journal-obligation-links";
import {
  getJournalObligationById,
  markJournalObligationOpened,
} from "@/lib/journal-obligations";
import { getServerSession } from "@/lib/server-session";

export default async function MiniObligationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(buildMiniAppAuthBootstrapPath(`/mini/o/${encodeURIComponent(id)}`));
  }

  const obligation = await getJournalObligationById(id, session.user.id);
  if (!obligation) {
    notFound();
  }

  const targetPath = sanitizeMiniAppRedirectPath(obligation.targetPath);
  if (!targetPath) {
    notFound();
  }

  // Точки: обязательство другой точки сначала переключает активную точку.
  // Cookie ставит route handler — серверная страница писать её не может.
  if (obligation.buildingId) {
    const cookieStore = await cookies();
    const currentBuildingId = decodeBuildingCookie(
      cookieStore.get(ACTIVE_BUILDING_COOKIE)?.value,
      getActiveOrgId(session),
    );
    if (currentBuildingId !== obligation.buildingId) {
      try {
        await markJournalObligationOpened(id, session.user.id);
      } catch (error) {
        console.error("Failed to mark journal obligation as opened", { id, error });
      }
      redirect(
        `/api/me/active-building/go?building=${encodeURIComponent(obligation.buildingId)}&next=${encodeURIComponent(targetPath)}`,
      );
    }
  }

  try {
    await markJournalObligationOpened(id, session.user.id);
  } catch (error) {
    console.error("Failed to mark journal obligation as opened", {
      id,
      userId: session.user.id,
      error,
    });
  }

  redirect(targetPath);
}
