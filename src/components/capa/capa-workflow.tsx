"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WORKFLOW: Record<string, { nextStatus: string; nextLabel: string; field: string; fieldLabel: string; fieldPlaceholder: string }> = {
  open: {
    nextStatus: "investigating",
    nextLabel: "Начать расследование",
    field: "rootCause",
    fieldLabel: "Предварительная оценка",
    fieldPlaceholder: "Опишите предварительные наблюдения...",
  },
  investigating: {
    nextStatus: "corrective_action",
    nextLabel: "Назначить корректировку",
    field: "rootCause",
    fieldLabel: "Корневая причина",
    fieldPlaceholder: "5 Why: почему произошло отклонение?",
  },
  corrective_action: {
    nextStatus: "verification",
    nextLabel: "На верификацию",
    field: "correctiveAction",
    fieldLabel: "Корректирующее действие",
    fieldPlaceholder: "Что было сделано для устранения?",
  },
  verification: {
    nextStatus: "closed",
    nextLabel: "Закрыть CAPA",
    field: "verificationResult",
    fieldLabel: "Результат верификации",
    fieldPlaceholder: "Подтвердите, что проблема устранена",
  },
};

interface Props {
  ticketId: string;
  currentStatus: string;
}

export function CapaWorkflow({ ticketId, currentStatus }: Props) {
  const router = useRouter();
  const [fieldValue, setFieldValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const step = WORKFLOW[currentStatus];
  if (!step) return null;

  async function handleAdvance() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/capa/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: step.nextStatus,
          [step.field]: fieldValue || undefined,
        }),
      });
      if (!res.ok) throw new Error("Ошибка");
      router.refresh();
    } catch {
      setError("Не удалось обновить статус");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Следующий шаг</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          <Label>{step.fieldLabel}</Label>
          <Textarea
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder={step.fieldPlaceholder}
          />
        </div>
        <Button onClick={handleAdvance} disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {step.nextLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
