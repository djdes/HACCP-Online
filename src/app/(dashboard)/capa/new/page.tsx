import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { CapaForm } from "@/components/capa/capa-form";

export default async function NewCapaPage() {
  const session = await requireAuth();

  const users = await db.user.findMany({
    where: { organizationId: session.user.organizationId, isActive: true },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Новый CAPA</h1>
      <CapaForm users={users} />
    </div>
  );
}
