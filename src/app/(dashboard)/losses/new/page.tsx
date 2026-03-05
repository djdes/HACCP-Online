import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { LossForm } from "@/components/losses/loss-form";

export default async function NewLossPage() {
  const session = await requireAuth();
  const areas = await db.area.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Записать потерю</h1>
      <LossForm areas={areas} />
    </div>
  );
}
