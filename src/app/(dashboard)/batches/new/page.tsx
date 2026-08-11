import { requireAuth } from "@/lib/auth-helpers";
import { BatchForm } from "@/components/batches/batch-form";

export default async function NewBatchPage() {
  await requireAuth();
  return (
    <div className="space-y-5">
      <h1 className="text-[clamp(1.75rem,2vw+1rem,2rem)] leading-tight font-bold">Новая партия</h1>
      <BatchForm />
    </div>
  );
}
