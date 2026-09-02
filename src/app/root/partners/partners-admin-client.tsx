"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Building2, CalendarCheck, Download, FileCheck2, ScrollText, Wallet } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  EmptyState,
  Field,
  Pill,
  btnOutline,
  btnPrimary,
  formatDate,
  formatDateTime,
  formatMonth,
  formatRubFixed,
  inputClass,
  readError,
  textareaClass,
} from "@/components/partner/ui";
import type { AdminPartnerRow } from "@/lib/partners/admin";
import { cn } from "@/lib/utils";

import { REVIEW_ACTION_LABELS, ReviewDialog, availableReviewActions, type ReviewAction } from "./review-dialog";

export type AdminTab = "applications" | "partners" | "payouts" | "rules";

export type PayoutLineView = {
  partnerId: string;
  companyName: string;
  slug: string;
  payoutTypeLabel: string | null;
  payoutDetailsText: string;
  agreementSigned: boolean;
  agreementNumber: string | null;
  payableRub: number;
  carryOver: boolean;
  accrualCount: number;
};

export type RuleVersionView = {
  id: string;
  version: number;
  subscriptionPercent: number;
  subscriptionMonths: number;
  hardwarePercent: number;
  bonusAmountRub: number;
  bonusAfterPayments: number;
  minPayoutRub: number;
  comment: string | null;
  effectiveFrom: string;
};

type Counts = Record<"pending" | "active" | "rejected" | "suspended", number>;

const STATUS_TONE: Record<string, "neutral" | "ok" | "warn" | "danger" | "indigo"> = {
  pending: "warn",
  active: "ok",
  rejected: "neutral",
  suspended: "danger",
};

const TABS: Array<{ key: AdminTab; label: string; icon: typeof Building2 }> = [
  { key: "applications", label: "Заявки", icon: FileCheck2 },
  { key: "partners", label: "Партнёры", icon: Building2 },
  { key: "payouts", label: "Ведомость", icon: Wallet },
  { key: "rules", label: "Правила", icon: ScrollText },
];

function previousMonthKey(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PartnersAdminClient({
  initialTab,
  partners,
  counts,
  payoutLines,
  minPayoutRub,
  rules,
}: {
  initialTab: AdminTab;
  partners: AdminPartnerRow[];
  counts: Counts;
  payoutLines: PayoutLineView[];
  minPayoutRub: number;
  rules: RuleVersionView[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [review, setReview] = useState<{ partnerId: string; name: string; action: ReviewAction } | null>(null);

  const badges: Partial<Record<AdminTab, number>> = {
    applications: counts.pending,
    partners: counts.active + counts.suspended,
    payouts: payoutLines.filter((l) => !l.carryOver).length,
  };

  function switchTab(next: AdminTab) {
    setTab(next);
    window.history.replaceState(null, "", `/root/partners?tab=${next}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const badge = badges[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-[14px] font-medium transition-colors duration-200",
                active
                  ? "border-[#5566f6] bg-[#5566f6] text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)]"
                  : "border-[#dcdfed] bg-white text-[#0b1024] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]",
              )}
            >
              <Icon className={cn("size-4", active ? "text-white" : "text-[#5566f6]")} />
              {label}
              {badge ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[12px] tabular-nums",
                    active ? "bg-white/20 text-white" : "bg-[#eef1ff] text-[#3848c7]",
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "applications" ? (
        <ApplicationsTab
          partners={partners.filter((p) => p.status === "pending")}
          rejected={partners.filter((p) => p.status === "rejected")}
          onReview={setReview}
        />
      ) : null}
      {tab === "partners" ? (
        <PartnersTab partners={partners.filter((p) => p.status === "active" || p.status === "suspended")} onReview={setReview} />
      ) : null}
      {tab === "payouts" ? (
        <PayoutsTab lines={payoutLines} minPayoutRub={minPayoutRub} onChanged={() => router.refresh()} />
      ) : null}
      {tab === "rules" ? <RulesTab rules={rules} onChanged={() => router.refresh()} /> : null}

      <ReviewDialog
        target={review}
        onClose={() => setReview(null)}
        onDone={() => {
          setReview(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/* ---------- Заявки ---------- */

function ApplicationsTab({
  partners,
  rejected,
  onReview,
}: {
  partners: AdminPartnerRow[];
  rejected: AdminPartnerRow[];
  onReview: (t: { partnerId: string; name: string; action: ReviewAction }) => void;
}) {
  return (
    <div className="space-y-5">
      {partners.length === 0 ? (
        <EmptyState
          title="Новых заявок нет"
          hint="Заявки приходят с публичной страницы /partners и из настроек организации («Стать партнёром»). О каждой вы получаете уведомление в Telegram."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {partners.map((p) => (
            <ApplicationCard key={p.id} partner={p} onReview={onReview} />
          ))}
        </div>
      )}

      {rejected.length > 0 ? (
        <Card eyebrow="Архив" title={`Отклонённые заявки · ${rejected.length}`}>
          <PartnersTable partners={rejected} onReview={onReview} />
        </Card>
      ) : null}
    </div>
  );
}

function ApplicationCard({
  partner: p,
  onReview,
}: {
  partner: AdminPartnerRow;
  onReview: (t: { partnerId: string; name: string; action: ReviewAction }) => void;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/root/partners/${p.id}`}
            className="text-[17px] font-semibold tracking-[-0.01em] text-[#0b1024] transition-colors hover:text-[#3848c7]"
          >
            {p.companyName}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#6f7282]">
            <Pill tone="indigo">{p.typeLabel}</Pill>
            <span>{p.city}</span>
            <span>·</span>
            <span>ИНН {p.inn}</span>
            <span>·</span>
            <span>объектов: {p.venuesCount}</span>
          </div>
        </div>
        <span className="shrink-0 text-[12px] text-[#9b9fb3]">{formatDateTime(p.createdAt)}</span>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
        <Row label="Slug">
          <code className="rounded bg-[#f4f5fb] px-1.5 py-0.5 text-[13px]">/p/{p.slug}</code>
        </Row>
        <Row label="Телефон">{p.phone}</Row>
        <Row label="Email">{p.contactEmail}</Row>
        <Row label="Telegram">{p.telegram ? `@${p.telegram.replace(/^@/, "")}` : "—"}</Row>
        <Row label="Заявитель">
          {p.applicantName || "—"}
          {p.applicantEmail ? <span className="text-[#6f7282]"> · {p.applicantEmail}</span> : null}
        </Row>
        <Row label="Организация">{p.applicantOrganizationName || "—"}</Row>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#f2f3f8] pt-4">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => onReview({ partnerId: p.id, name: p.companyName, action: "approve" })}
        >
          Одобрить
        </button>
        <button
          type="button"
          className={btnOutline}
          onClick={() => onReview({ partnerId: p.id, name: p.companyName, action: "reject" })}
        >
          Отклонить
        </button>
        <Link href={`/root/partners/${p.id}`} className={cn(btnOutline, "ml-auto")}>
          Карточка <ArrowRight className="size-4 text-[#5566f6]" />
        </Link>
      </div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[96px] shrink-0 text-[#6f7282]">{label}</dt>
      <dd className="min-w-0 break-words text-[#0b1024]">{children}</dd>
    </div>
  );
}

/* ---------- Партнёры ---------- */

function PartnersTab({
  partners,
  onReview,
}: {
  partners: AdminPartnerRow[];
  onReview: (t: { partnerId: string; name: string; action: ReviewAction }) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) =>
      [p.companyName, p.brandName, p.slug, p.inn, p.city, p.contactEmail, p.applicantEmail ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [partners, query]);

  if (partners.length === 0) {
    return (
      <EmptyState
        title="Действующих партнёров пока нет"
        hint="Одобрите заявку на вкладке «Заявки» — партнёр появится здесь вместе со своими клиентами и балансом."
      />
    );
  }

  return (
    <Card
      title={`Действующие и приостановленные · ${partners.length}`}
      actions={
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: название, slug, ИНН, город, email"
          className={cn(inputClass, "h-10 w-[300px] max-w-full text-[14px]")}
        />
      }
    >
      <PartnersTable partners={filtered} onReview={onReview} />
    </Card>
  );
}

function PartnersTable({
  partners,
  onReview,
}: {
  partners: AdminPartnerRow[];
  onReview: (t: { partnerId: string; name: string; action: ReviewAction }) => void;
}) {
  if (partners.length === 0) {
    return <p className="py-6 text-center text-[14px] text-[#6f7282]">Ничего не найдено.</p>;
  }
  return (
    <div className="-mx-5 overflow-x-auto md:-mx-6">
      <table className="w-full min-w-[960px] text-[14px]">
        <thead className="bg-[#f8f9fc] text-[12px] uppercase tracking-[0.08em] text-[#6f7282]">
          <tr>
            <th className="px-5 py-3 text-left font-medium md:px-6">Партнёр</th>
            <th className="px-3 py-3 text-left font-medium">Статус</th>
            <th className="px-3 py-3 text-left font-medium">Тип</th>
            <th className="px-3 py-3 text-right font-medium">Клиентов</th>
            <th className="px-3 py-3 text-left font-medium">Готовность</th>
            <th className="px-3 py-3 text-left font-medium">Заявка</th>
            <th className="px-5 py-3 text-right font-medium md:px-6">Действия</th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => {
            const actions = availableReviewActions(p.status);
            return (
              <tr key={p.id} className="border-t border-[#f2f3f8] align-top">
                <td className="px-5 py-3 md:px-6">
                  <Link
                    href={`/root/partners/${p.id}`}
                    className="font-medium text-[#0b1024] transition-colors hover:text-[#3848c7]"
                  >
                    {p.brandName || p.companyName}
                  </Link>
                  <div className="mt-0.5 text-[12px] text-[#6f7282]">
                    {p.brandName && p.brandName !== p.companyName ? `${p.companyName} · ` : ""}
                    /p/{p.slug} · {p.city}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Pill tone={STATUS_TONE[p.status] ?? "neutral"}>{p.statusLabel}</Pill>
                  {p.reviewComment ? (
                    <div className="mt-1 max-w-[220px] text-[12px] leading-[1.4] text-[#6f7282]" title={p.reviewComment}>
                      {p.reviewComment.length > 70 ? `${p.reviewComment.slice(0, 70)}…` : p.reviewComment}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-[#3c4053]">{p.typeLabel}</td>
                <td className="px-3 py-3 text-right tabular-nums text-[#0b1024]">
                  {p.activeClients}
                  {p.totalClients > p.activeClients ? (
                    <span className="text-[#9b9fb3]"> / {p.totalClients}</span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Pill tone={p.agreementSigned ? "ok" : "neutral"}>
                      {p.agreementSigned ? "договор" : "без договора"}
                    </Pill>
                    <Pill tone={p.payoutFilled ? "ok" : "neutral"}>
                      {p.payoutFilled ? "реквизиты" : "без реквизитов"}
                    </Pill>
                    <Pill tone={p.onboardingDone ? "ok" : "neutral"}>
                      {p.onboardingDone ? "онбординг" : "онбординг не пройден"}
                    </Pill>
                  </div>
                </td>
                <td className="px-3 py-3 text-[13px] text-[#6f7282]">{formatDate(p.createdAt)}</td>
                <td className="px-5 py-3 text-right md:px-6">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {actions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className={cn(btnOutline, "h-8 px-3 text-[13px]")}
                        onClick={() => onReview({ partnerId: p.id, name: p.companyName, action })}
                      >
                        {REVIEW_ACTION_LABELS[action]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Ведомость ---------- */

function PayoutsTab({
  lines,
  minPayoutRub,
  onChanged,
}: {
  lines: PayoutLineView[];
  minPayoutRub: number;
  onChanged: () => void;
}) {
  const [closeOpen, setCloseOpen] = useState(false);
  const [period, setPeriod] = useState(previousMonthKey());
  const [payTarget, setPayTarget] = useState<PayoutLineView | null>(null);
  const [paidAt, setPaidAt] = useState(todayKey());
  const [documentNo, setDocumentNo] = useState("");

  const payable = lines.filter((l) => !l.carryOver);
  const carry = lines.filter((l) => l.carryOver);
  const totalPayable = payable.reduce((s, l) => s + l.payableRub, 0);

  async function closeMonth() {
    const res = await fetch("/api/root/partners/payouts/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    if (!res.ok) {
      toast.error(await readError(res, "Не удалось закрыть месяц"));
      return;
    }
    const data = (await res.json()) as { period: string; moved: number };
    toast.success(`Месяц ${formatMonth(data.period)} закрыт: строк к выплате — ${data.moved}`);
    setCloseOpen(false);
    onChanged();
  }

  async function markPaid() {
    if (!payTarget) return;
    if (!documentNo.trim()) {
      toast.error("Укажите номер платёжного документа");
      return;
    }
    const res = await fetch(`/api/root/partners/payouts/${payTarget.partnerId}/paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paidAt, documentNo: documentNo.trim() }),
    });
    if (!res.ok) {
      toast.error(await readError(res, "Не удалось отметить выплату"));
      return;
    }
    const data = (await res.json()) as { paidRub: number; count: number };
    toast.success(`Выплачено ${formatRubFixed(data.paidRub)} — строк: ${data.count}. Партнёр уведомлён.`);
    setPayTarget(null);
    setDocumentNo("");
    onChanged();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="К выплате сейчас" value={formatRubFixed(totalPayable)} hint={`партнёров: ${payable.length}`} accent />
        <Stat label="Переносится" value={String(carry.length)} hint={`меньше минимума ${minPayoutRub.toLocaleString("ru-RU")} ₽`} />
        <Stat label="Минимальная выплата" value={`${minPayoutRub.toLocaleString("ru-RU")} ₽`} hint="из текущих правил" />
      </div>

      <Card
        eyebrow="Ведомость"
        title="Партнёры со статусом «к выплате»"
        actions={
          <>
            {/* Скачивание файла, а не переход по приложению — обычный <a>, как в экспорте сотрудников. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/root/partners/payouts?format=csv" className={btnOutline} download>
              <Download className="size-4 text-[#5566f6]" /> CSV для бухгалтерии
            </a>
            <button type="button" className={btnOutline} onClick={() => setCloseOpen(true)}>
              <CalendarCheck className="size-4 text-[#5566f6]" /> Закрыть месяц
            </button>
          </>
        }
      >
        <p className="mb-4 text-[13px] leading-[1.55] text-[#6f7282]">
          Строки попадают сюда после закрытия месяца (cron 1-го числа или кнопка выше). «Отметить выплаченным»
          переводит все строки партнёра в «выплачено» с датой и номером документа и уведомляет его в Telegram.
          Суммы меньше минимума остаются к выплате и складываются со следующим месяцем.
        </p>
        {lines.length === 0 ? (
          <EmptyState title="Выплачивать нечего" hint="Нет начислений в статусе «к выплате». Закройте месяц, если начисления уже есть." />
        ) : (
          <div className="-mx-5 overflow-x-auto md:-mx-6">
            <table className="w-full min-w-[880px] text-[14px]">
              <thead className="bg-[#f8f9fc] text-[12px] uppercase tracking-[0.08em] text-[#6f7282]">
                <tr>
                  <th className="px-5 py-3 text-left font-medium md:px-6">Партнёр</th>
                  <th className="px-3 py-3 text-left font-medium">Форма · реквизиты</th>
                  <th className="px-3 py-3 text-left font-medium">Договор</th>
                  <th className="px-3 py-3 text-right font-medium">Строк</th>
                  <th className="px-3 py-3 text-right font-medium">К выплате</th>
                  <th className="px-5 py-3 text-right font-medium md:px-6"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const blocked = !line.agreementSigned || !line.payoutDetailsText;
                  return (
                    <tr key={line.partnerId} className="border-t border-[#f2f3f8] align-top">
                      <td className="px-5 py-3 md:px-6">
                        <Link
                          href={`/root/partners/${line.partnerId}`}
                          className="font-medium text-[#0b1024] transition-colors hover:text-[#3848c7]"
                        >
                          {line.companyName}
                        </Link>
                        <div className="text-[12px] text-[#6f7282]">/p/{line.slug}</div>
                      </td>
                      <td className="max-w-[320px] px-3 py-3 text-[13px] text-[#3c4053]">
                        {line.payoutTypeLabel ? <Pill tone="indigo">{line.payoutTypeLabel}</Pill> : null}
                        <div className="mt-1 break-words">
                          {line.payoutDetailsText || <span className="text-[#a13a32]">реквизиты не заполнены</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {line.agreementSigned ? (
                          <Pill tone="ok">подписан{line.agreementNumber ? ` № ${line.agreementNumber}` : ""}</Pill>
                        ) : (
                          <Pill tone="danger">не подписан</Pill>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[#6f7282]">{line.accrualCount}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-[#0b1024]">
                        {formatRubFixed(line.payableRub)}
                        {line.carryOver ? <div className="text-[12px] font-normal text-[#9a4a06]">перенос</div> : null}
                      </td>
                      <td className="px-5 py-3 text-right md:px-6">
                        <button
                          type="button"
                          className={cn(btnPrimary, "h-8 px-3 text-[13px]")}
                          disabled={line.carryOver}
                          title={
                            line.carryOver
                              ? "Сумма меньше минимума — переносится на следующий месяц"
                              : blocked
                                ? "Договор не подписан или нет реквизитов — выплата под вашу ответственность"
                                : undefined
                          }
                          onClick={() => {
                            setPayTarget(line);
                            setPaidAt(todayKey());
                            setDocumentNo("");
                          }}
                        >
                          Отметить выплаченным
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onConfirm={closeMonth}
        title="Закрыть месяц вручную?"
        description="Все начисления выбранного месяца и раньше перейдут из «начислено» в «к выплате». Обычно это делает cron 1-го числа; кнопка нужна, если он не отработал или месяц надо закрыть раньше."
        bullets={[
          { label: "Новые начисления за текущий месяц не затрагиваются", tone: "info" },
          { label: "Повторное закрытие того же месяца ничего не меняет", tone: "default" },
        ]}
        confirmLabel="Закрыть месяц"
        variant="info"
      >
        <Field label="Месяц (включительно)" hint="Формат ГГГГ-ММ. По умолчанию — прошлый месяц.">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={inputClass}
          />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        onConfirm={markPaid}
        title={payTarget ? `Отметить выплату «${payTarget.companyName}»?` : ""}
        description={
          payTarget
            ? `Все ${payTarget.accrualCount} строк к выплате на сумму ${formatRubFixed(payTarget.payableRub)} станут «выплачено». Отменить отметку нельзя — проверьте, что перевод действительно отправлен.`
            : undefined
        }
        bullets={
          payTarget
            ? [
                ...(!payTarget.agreementSigned
                  ? [{ label: "Договор с партнёром не подписан", tone: "warn" as const }]
                  : []),
                ...(!payTarget.payoutDetailsText
                  ? [{ label: "Реквизиты партнёром не заполнены", tone: "warn" as const }]
                  : []),
                { label: "Партнёр получит уведомление в Telegram с суммой и номером документа", tone: "info" as const },
              ]
            : undefined
        }
        confirmLabel="Выплачено"
        variant="default"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Дата выплаты">
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} />
          </Field>
          <Field label="№ платёжного документа">
            <input
              value={documentNo}
              onChange={(e) => setDocumentNo(e.target.value)}
              maxLength={64}
              placeholder="п/п 148"
              className={inputClass}
            />
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent ? "border-[#5566f6]/30 bg-[#f5f6ff]" : "border-[#ececf4] bg-white",
      )}
    >
      <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#6f7282]">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[#0b1024]">{value}</div>
      {hint ? <div className="mt-0.5 text-[12px] text-[#6f7282]">{hint}</div> : null}
    </div>
  );
}

/* ---------- Правила ---------- */

function RulesTab({ rules, onChanged }: { rules: RuleVersionView[]; onChanged: () => void }) {
  const current = rules[0];
  const [form, setForm] = useState({
    subscriptionPercent: String(current?.subscriptionPercent ?? 20),
    subscriptionMonths: String(current?.subscriptionMonths ?? 12),
    hardwarePercent: String(current?.hardwarePercent ?? 15),
    bonusAmountRub: String(current?.bonusAmountRub ?? 3000),
    bonusAfterPayments: String(current?.bonusAfterPayments ?? 2),
    minPayoutRub: String(current?.minPayoutRub ?? 1000),
    comment: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const changed =
    !current ||
    Number(form.subscriptionPercent) !== current.subscriptionPercent ||
    Number(form.subscriptionMonths) !== current.subscriptionMonths ||
    Number(form.hardwarePercent) !== current.hardwarePercent ||
    Number(form.bonusAmountRub) !== current.bonusAmountRub ||
    Number(form.bonusAfterPayments) !== current.bonusAfterPayments ||
    Number(form.minPayoutRub) !== current.minPayoutRub;

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!changed) {
      toast.info("Значения совпадают с текущей версией — новая не нужна");
      return;
    }
    setConfirmOpen(true);
  }

  async function publish() {
    const res = await fetch("/api/root/partners/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionPercent: Number(form.subscriptionPercent),
        subscriptionMonths: Number(form.subscriptionMonths),
        hardwarePercent: Number(form.hardwarePercent),
        bonusAmountRub: Number(form.bonusAmountRub),
        bonusAfterPayments: Number(form.bonusAfterPayments),
        minPayoutRub: Number(form.minPayoutRub),
        comment: form.comment,
      }),
    });
    if (!res.ok) {
      toast.error(await readError(res, "Не удалось сохранить правила"));
      return;
    }
    const data = (await res.json()) as { rule: { version: number } };
    toast.success(`Опубликована версия ${data.rule.version} правил вознаграждения`);
    setConfirmOpen(false);
    setForm((f) => ({ ...f, comment: "" }));
    onChanged();
  }

  const numberField = (label: string, key: keyof typeof form, suffix: string, hint: string, step = "1") => (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={form[key]}
          onChange={set(key)}
          className={cn(inputClass, "pr-14")}
          required
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] text-[#6f7282]">
          {suffix}
        </span>
      </div>
    </Field>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card
        eyebrow={current ? `Версия ${current.version} · с ${formatDate(current.effectiveFrom)}` : "Версия 1"}
        title="Новая версия правил"
      >
        <p className="mb-4 text-[13px] leading-[1.55] text-[#6f7282]">
          Правила версионируются: уже созданные начисления хранят свою версию и не пересчитываются. Новая версия
          применяется к платежам после публикации. Партнёры видят актуальную версию у себя в разделе
          «Вознаграждение» (только чтение).
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {numberField("Доля с подписки", "subscriptionPercent", "%", "От каждого платежа клиента за подписку.", "0.5")}
            {numberField("Срок доли", "subscriptionMonths", "мес.", "Считается от первого платежа клиента после привязки.")}
            {numberField("Доля с оборудования", "hardwarePercent", "%", "Начисляется после отметки «отгружено».", "0.5")}
            {numberField("Разовый бонус", "bonusAmountRub", "₽", "За «закрепившегося» клиента.")}
            {numberField("Бонус после платежа №", "bonusAfterPayments", "", "Порядковый номер успешного платежа за подписку.")}
            {numberField("Минимальная выплата", "minPayoutRub", "₽", "Меньше — переносится на следующий месяц.")}
          </div>
          <Field label="Комментарий к версии" hint="Виден только ROOT в истории версий.">
            <textarea
              value={form.comment}
              onChange={set("comment")}
              rows={2}
              maxLength={500}
              placeholder="Например: подняли долю с подписки на осенний сезон"
              className={textareaClass}
            />
          </Field>
          <div className="flex items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={!changed}>
              Опубликовать версию {(current?.version ?? 0) + 1}
            </button>
            {!changed ? <span className="text-[13px] text-[#6f7282]">Измените хотя бы одно значение</span> : null}
          </div>
        </form>
      </Card>

      <Card eyebrow="История" title="Версии">
        {rules.length === 0 ? (
          <p className="text-[14px] text-[#6f7282]">
            Версия 1 со значениями из ТЗ (20 % / 12 мес. / 15 % / 3 000 ₽ / после 2-го платежа / мин. 1 000 ₽)
            создаётся автоматически при первом начислении.
          </p>
        ) : (
          <ol className="space-y-3">
            {rules.map((r, i) => (
              <li key={r.id} className={cn("rounded-2xl border p-3.5", i === 0 ? "border-[#5566f6]/30 bg-[#f5f6ff]" : "border-[#ececf4] bg-white")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-[#0b1024]">Версия {r.version}</span>
                  {i === 0 ? <Pill tone="indigo">действует</Pill> : <span className="text-[12px] text-[#9b9fb3]">с {formatDate(r.effectiveFrom)}</span>}
                </div>
                <div className="mt-1.5 text-[13px] leading-[1.5] text-[#3c4053]">
                  {r.subscriptionPercent} % подписка · {r.subscriptionMonths} мес. · {r.hardwarePercent} % оборудование ·
                  бонус {r.bonusAmountRub.toLocaleString("ru-RU")} ₽ после {r.bonusAfterPayments}-го платежа · мин.{" "}
                  {r.minPayoutRub.toLocaleString("ru-RU")} ₽
                </div>
                {i === 0 ? <div className="mt-1 text-[12px] text-[#6f7282]">с {formatDate(r.effectiveFrom)}</div> : null}
                {r.comment ? <div className="mt-1 text-[12px] italic text-[#6f7282]">{r.comment}</div> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={publish}
        title={`Опубликовать версию ${(current?.version ?? 0) + 1}?`}
        description="Новые платежи будут считаться по этим значениям. Уже созданные начисления остаются как есть."
        bullets={[
          { label: `Подписка ${form.subscriptionPercent} % в течение ${form.subscriptionMonths} мес.`, tone: "info" },
          { label: `Оборудование ${form.hardwarePercent} % после отгрузки`, tone: "info" },
          { label: `Бонус ${Number(form.bonusAmountRub).toLocaleString("ru-RU")} ₽ после ${form.bonusAfterPayments}-го платежа`, tone: "info" },
          { label: `Минимальная выплата ${Number(form.minPayoutRub).toLocaleString("ru-RU")} ₽`, tone: "default" },
          { label: "Партнёры увидят новые условия в кабинете сразу", tone: "warn" },
        ]}
        confirmLabel="Опубликовать"
        variant="info"
      />
    </div>
  );
}
