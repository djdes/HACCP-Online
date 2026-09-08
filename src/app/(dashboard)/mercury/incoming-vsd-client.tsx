"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Deadline = { tone: "ok" | "soon" | "overdue"; hoursLeft: number | null; daysOverdue: number };

export type VsdRow = {
  id: string;
  uuid: string;
  number: string | null;
  remoteStatus: string;
  localStatus: string;
  deliveryDate: string | null;
  processingDueAt: string | null;
  productName: string | null;
  volume: number | null;
  unit: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  consignorName: string | null;
  manufacturerName: string | null;
  accompanyingDocs: string | null;
  transportInfo: string | null;
  processError: string | null;
  journalDocumentId: string | null;
  deadline: Deadline;
};

const TABS = [
  { key: "pending", label: "Ждут гашения" },
  { key: "overdue", label: "Просрочено" },
  { key: "processed", label: "Погашено" },
  { key: "all", label: "Все" },
] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

function DeadlineBadge({ deadline, status }: { deadline: Deadline; status: string }) {
  if (status === "processed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[12px] font-medium text-[#116b2a]">
        <CheckCircle2 className="size-3.5" /> Погашен
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f6ff] px-2.5 py-1 text-[12px] font-medium text-[#3848c7]">
        <Loader2 className="size-3.5 animate-spin" /> Отправляем гашение
      </span>
    );
  }
  if (deadline.tone === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4f2] px-2.5 py-1 text-[12px] font-medium text-[#a13a32]">
        <AlertTriangle className="size-3.5" />
        Просрочен{deadline.daysOverdue > 0 ? ` на ${deadline.daysOverdue} дн.` : ""}
      </span>
    );
  }
  if (deadline.tone === "soon") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff8e6] px-2.5 py-1 text-[12px] font-medium text-[#a1740a]">
        <Clock className="size-3.5" /> Сегодня до конца дня
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f2f6] px-2.5 py-1 text-[12px] text-[#6f7282]">
      <Clock className="size-3.5" /> В срок
    </span>
  );
}

export function IncomingVsdClient({
  documents,
  enabled,
  demoMode,
}: {
  documents: VsdRow[];
  enabled: boolean;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const [active, setActive] = useState<VsdRow | null>(null);

  const filtered = useMemo(() => {
    switch (tab) {
      case "pending":
        return documents.filter((d) => ["new", "acknowledged"].includes(d.localStatus));
      case "overdue":
        return documents.filter(
          (d) =>
            ["new", "acknowledged"].includes(d.localStatus) &&
            d.deadline.tone === "overdue",
        );
      case "processed":
        return documents.filter((d) => d.localStatus === "processed");
      default:
        return documents;
    }
  }, [documents, tab]);

  const counts = useMemo(
    () => ({
      pending: documents.filter((d) => ["new", "acknowledged"].includes(d.localStatus)).length,
      overdue: documents.filter(
        (d) => ["new", "acknowledged"].includes(d.localStatus) && d.deadline.tone === "overdue",
      ).length,
      processed: documents.filter((d) => d.localStatus === "processed").length,
      all: documents.length,
    }),
    [documents],
  );

  return (
    <div className="space-y-4">
      {demoMode ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#f0c674] bg-[#fff8e6] p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#a1740a]" />
          <div className="text-[13px] leading-[1.6] text-[#7a5a08]">
            <div className="font-semibold">Демо-режим — данные не из Меркурия</div>
            Это учебные документы. Настоящие появятся после подключения к Ветис.API.
          </div>
        </div>
      ) : null}

      {!enabled ? (
        <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 text-[13px] leading-[1.6] text-[#6f7282]">
          Синхронизация выключена.{" "}
          <Link href="/settings/integrations/mercury" className="text-[#3848c7] underline">
            Включить в настройках
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-150 ${
              tab === t.key
                ? "bg-[#5566f6] text-white"
                : "bg-[#f5f6ff] text-[#3848c7] hover:bg-[#eef1ff]"
            }`}
          >
            {t.label}
            <span className="tabular-nums opacity-70">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <div className="text-[15px] font-medium text-[#0b1024]">
            {tab === "pending" ? "Всё погашено" : "Здесь пусто"}
          </div>
          <p className="mx-auto mt-1.5 max-w-[380px] text-[13px] text-[#6f7282]">
            {tab === "pending"
              ? "Новые входящие ВСД появятся здесь автоматически."
              : "Попробуйте другую вкладку."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((doc) => (
            <li
              key={doc.id}
              className="rounded-2xl border border-[#ececf4] bg-white p-4 transition-colors hover:border-[#5566f6]/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-[#0b1024]">
                      {doc.productName || "Без названия"}
                    </span>
                    <DeadlineBadge deadline={doc.deadline} status={doc.localStatus} />
                  </div>
                  <div className="mt-1 text-[13px] text-[#6f7282]">
                    {doc.consignorName || "поставщик не указан"}
                    {doc.volume ? ` · ${doc.volume} ${doc.unit ?? ""}` : ""}
                    {doc.batchNumber ? ` · партия ${doc.batchNumber}` : ""}
                  </div>
                  <div className="mt-1 text-[12px] text-[#9b9fb3]">
                    ВСД № {doc.number ?? doc.uuid.slice(0, 8)} · поставка{" "}
                    {formatDate(doc.deliveryDate)} · годен до {formatDate(doc.expiryDate)}
                  </div>
                  {doc.processError ? (
                    <div className="mt-2 rounded-xl bg-[#fff4f2] px-3 py-2 text-[12px] text-[#a13a32]">
                      {doc.processError}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {doc.journalDocumentId ? (
                    <Link
                      href={`/journals/incoming_control/documents/${doc.journalDocumentId}`}
                      className="inline-flex h-10 items-center rounded-2xl border border-[#dcdfed] bg-white px-3.5 text-[13px] font-medium text-[#0b1024] hover:bg-[#f5f6ff]"
                    >
                      В журнале
                    </Link>
                  ) : null}
                  {["new", "acknowledged", "process_failed"].includes(doc.localStatus) ? (
                    <Button
                      onClick={() => setActive(doc)}
                      className="h-10 rounded-2xl bg-[#5566f6] px-4 text-[13px] font-medium text-white hover:bg-[#4a5bf0]"
                    >
                      Оформить приёмку
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AcceptDialog
        doc={active}
        onClose={() => setActive(null)}
        onDone={() => {
          setActive(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * Окно приёмки: слева — что сказал Меркурий, справа — что увидел человек.
 *
 * Поля физического контроля намеренно без «правильных» умолчаний: их
 * ставит приёмщик, и в этом весь смысл журнала входного контроля.
 */
function AcceptDialog({
  doc,
  onClose,
  onDone,
}: {
  doc: VsdRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [temp, setTemp] = useState("");
  const [transportOk, setTransportOk] = useState(true);
  const [packagingOk, setPackagingOk] = useState(true);
  const [organolepticOk, setOrganolepticOk] = useState(true);
  const [documentsOk, setDocumentsOk] = useState(true);
  const [decision, setDecision] = useState<"ACCEPT" | "REJECT">("ACCEPT");
  const [reason, setReason] = useState("");
  const [withdraw, setWithdraw] = useState(true);

  async function submit() {
    if (!doc) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/mercury/documents/${doc.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transportConditionOk: transportOk,
          packagingOk,
          organolepticOk,
          documentsOk,
          decision,
          productTemperature: temp || undefined,
          discrepancyReason: decision === "ACCEPT" ? undefined : reason,
          correctiveActions: decision === "ACCEPT" ? undefined : reason,
          withdraw,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Не удалось оформить приёмку");
      toast.success(
        withdraw
          ? "Строка в журнале создана, гашение отправляется"
          : "Строка в журнале создана",
      );
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-[720px] overflow-y-auto rounded-[24px]">
        <DialogHeader>
          <DialogTitle>Приёмка партии</DialogTitle>
        </DialogHeader>

        {doc ? (
          <div className="space-y-5">
            <section className="rounded-2xl bg-[#fafbff] p-4 text-[13px] leading-[1.6] text-[#3c4053]">
              <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
                Из Меркурия
              </div>
              <div className="font-medium text-[#0b1024]">{doc.productName}</div>
              <div>
                {doc.consignorName}
                {doc.manufacturerName && doc.manufacturerName !== doc.consignorName
                  ? ` · изготовитель ${doc.manufacturerName}`
                  : ""}
              </div>
              <div>
                {doc.volume ? `${doc.volume} ${doc.unit ?? ""}` : "объём не указан"}
                {doc.batchNumber ? ` · партия ${doc.batchNumber}` : ""} · годен до{" "}
                {formatDate(doc.expiryDate)}
              </div>
              <div className="text-[#6f7282]">
                ВСД № {doc.number ?? doc.uuid.slice(0, 8)}
                {doc.accompanyingDocs ? ` · ${doc.accompanyingDocs}` : ""}
              </div>
            </section>

            <section className="space-y-3">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
                Физический контроль
              </div>
              <p className="text-[13px] leading-[1.55] text-[#6f7282]">
                Это то, чего Меркурий не знает и знать не может. Заполняет тот,
                кто принимал товар.
              </p>

              <div>
                <Label htmlFor="temp" className="text-[13px]">
                  Температура продукта
                </Label>
                <Input
                  id="temp"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  placeholder="например +4"
                  className="mt-1.5 h-11 rounded-2xl border-[#dcdfed] px-3.5 text-[14px] sm:w-[200px]"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { label: "Транспорт в порядке", value: transportOk, set: setTransportOk },
                  { label: "Упаковка и маркировка в порядке", value: packagingOk, set: setPackagingOk },
                  { label: "Органолептика в норме", value: organolepticOk, set: setOrganolepticOk },
                  { label: "Документы соответствуют", value: documentsOk, set: setDocumentsOk },
                ].map((item) => (
                  <label
                    key={item.label}
                    className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-[#ececf4] px-3.5 py-3 text-[13px] hover:bg-[#fafbff]"
                  >
                    <input
                      type="checkbox"
                      checked={item.value}
                      onChange={(e) => item.set(e.target.checked)}
                      className="size-4 accent-[#5566f6]"
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {(["ACCEPT", "REJECT"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDecision(value)}
                    className={`rounded-2xl px-4 py-2.5 text-[14px] font-medium transition-colors duration-150 ${
                      decision === value
                        ? value === "ACCEPT"
                          ? "bg-[#ecfdf5] text-[#116b2a]"
                          : "bg-[#fff4f2] text-[#a13a32]"
                        : "bg-[#f5f6ff] text-[#6f7282] hover:bg-[#eef1ff]"
                    }`}
                  >
                    {value === "ACCEPT" ? "Принять" : "Отказать"}
                  </button>
                ))}
              </div>

              {decision !== "ACCEPT" ? (
                <div>
                  <Label htmlFor="reason" className="text-[13px]">
                    Причина и что сделали
                  </Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Меркурий не примет отказ без причины"
                    className="mt-1.5 h-11 rounded-2xl border-[#dcdfed] px-3.5 text-[14px]"
                  />
                </div>
              ) : null}

              <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-[#f5f6ff] px-3.5 py-3 text-[13px]">
                <input
                  type="checkbox"
                  checked={withdraw}
                  onChange={(e) => setWithdraw(e.target.checked)}
                  className="mt-0.5 size-4 accent-[#5566f6]"
                />
                <span>
                  Погасить ВСД в Меркурии
                  <span className="mt-0.5 block text-[12px] text-[#6f7282]">
                    Снимите галочку, если гасите сами в кабинете — строка журнала
                    всё равно будет создана.
                  </span>
                </span>
              </label>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={submit}
                disabled={saving || (decision !== "ACCEPT" && !reason)}
                className="h-11 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0]"
              >
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {withdraw ? "Принять и погасить" : "Внести в журнал"}
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="h-11 rounded-2xl border-[#dcdfed] px-5 text-[14px]"
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
