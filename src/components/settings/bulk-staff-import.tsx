"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const PLACEHOLDER = `ФИО\tДолжность\tТелефон
Иван Петров\tПовар\t+7 985 123-45-67
Сергей Поваров\tШеф-повар\t+7 925 555-12-34
Мария Чайкова\tОфициант\t+7 999 444-22-11`;

/**
 * Минимальный CSV/TSV-импорт сотрудников. Открывается в диалоге, paste
 * из Excel/Айко прямо в textarea. Колонки: ФИО / Должность / Телефон.
 * Должности должны существовать заранее (или сначала примените онбординг-шаблон).
 */
export function BulkStaffImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/staff/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Ошибка импорта");
      const errCount = (data.errors ?? []).length;
      const autoMatched = data.autoMatched ?? 0;
      toast.success(
        `Создано: ${data.created}, пропущено (дубли): ${data.skipped}` +
          (autoMatched > 0
            ? `, авто-распознано должностей: ${autoMatched}`
            : "") +
          (errCount > 0 ? `, ошибок: ${errCount}` : "")
      );
      if (errCount > 0) {
        for (const e of data.errors.slice(0, 3)) {
          toast.warning(`Строка ${e.line}: ${e.message}`);
        }
      }
      setCsv("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-10 rounded-xl border-[#dcdfed] bg-white px-3 text-[13px] font-medium text-[#3a3f55] hover:bg-[#f5f6ff]"
      >
        <Upload className="mr-2 size-4" />
        Импорт CSV / Excel
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-[#dcdfed] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[14px] font-semibold text-[#0b1024]">
          Вставьте таблицу сотрудников
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          Отмена
        </button>
      </div>
      <p className="mb-2 text-[12px] leading-snug text-[#6f7282]">
        Колонки: <strong>ФИО</strong> / <strong>Должность</strong> /{" "}
        <strong>Телефон</strong>. Разделитель — табуляция (Excel/Google Sheets)
        или запятая. Должности с этим именем должны уже существовать.
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={8}
        spellCheck={false}
        className="w-full rounded-xl border border-[#dcdfed] bg-[#f5f6ff] px-3 py-2 font-mono text-[12px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none"
        placeholder={PLACEHOLDER}
      />
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          onClick={submit}
          disabled={busy || !csv.trim()}
          className="h-11 rounded-xl bg-[#5566f6] px-4 text-[13px] font-medium text-white hover:bg-[#4a5bf0]"
        >
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Upload className="mr-2 size-4" />
          )}
          Импортировать
        </Button>
      </div>
    </div>
  );
}
