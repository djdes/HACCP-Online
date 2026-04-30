"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Удалить продукт из справочника?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products?id=${productId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Продукт удалён.");
        router.refresh();
        return;
      }
      // Раньше при не-ok ответе кнопка молча гасла — юзер тапал ещё раз
      // и снова молчание. Теперь показываем ошибку из тела (например
      // «Продукт используется в N записях, удалить нельзя»).
      const body = await res.json().catch(() => null);
      const message =
        (body && typeof body === "object" && body !== null && "error" in body
          ? String((body as Record<string, unknown>).error)
          : null) ?? "Не удалось удалить продукт.";
      toast.error(message);
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={isDeleting}
      className="size-8 text-muted-foreground hover:text-destructive"
    >
      {isDeleting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </Button>
  );
}
