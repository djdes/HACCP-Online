import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { getPipelineForJournal } from "@/lib/journal-pipelines";
import { PipelineEditor } from "./pipeline-editor";

export const dynamic = "force-dynamic";

export default async function JournalPipelineEditorPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasCapability(session.user, "admin.full")) redirect("/journals");
  const organizationId = getActiveOrgId(session);
  const pipeline = await getPipelineForJournal(organizationId, code);
  return <PipelineEditor code={code} initial={pipeline} />;
}
