import { requireAuth } from "@/lib/auth-helpers";
import { ChangeForm } from "@/components/changes/change-form";

export default async function NewChangePage() {
  await requireAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Новое изменение</h1>
      <ChangeForm />
    </div>
  );
}
