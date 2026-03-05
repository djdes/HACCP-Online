import { requireAuth } from "@/lib/auth-helpers";
import { PlanForm } from "@/components/plans/plan-form";

export default async function NewPlanPage() {
  await requireAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Новый план</h1>
      <PlanForm />
    </div>
  );
}
