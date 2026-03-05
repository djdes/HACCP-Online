import { requireAuth } from "@/lib/auth-helpers";
import { BatchForm } from "@/components/batches/batch-form";

export default async function NewBatchPage() {
  await requireAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Новая партия</h1>
      <BatchForm />
    </div>
  );
}
