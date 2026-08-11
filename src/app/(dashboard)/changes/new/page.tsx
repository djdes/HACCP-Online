import { requireAuth } from "@/lib/auth-helpers";
import { ChangeForm } from "@/components/changes/change-form";

export default async function NewChangePage() {
  await requireAuth();
  return (
    <div className="space-y-5">
      <h1 className="text-[clamp(1.75rem,2vw+1rem,2rem)] leading-tight font-bold">Новое изменение</h1>
      <ChangeForm />
    </div>
  );
}
