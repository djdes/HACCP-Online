"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  SkipForward,
  Thermometer,
} from "lucide-react";

type Claim = {
  id: string;
  journalCode: string;
  scopeKey: string;
  scopeLabel: string;
  parentHint: string | null;
  status: string;
};

/**
 * Универсальная страница «выполнить claim» в Mini App.
 *
 *   /mini/claim/[id]
 *
 * Сотрудник попал сюда сразу после нажатия «Взять» в /mini/today
 * или /mini/journals/<code>. Страница рендерит ПРОСТУЮ форму с
 * полями типичными для journalCode и postит её на
 * /api/journal-task-claims/[id] action=complete + data — backend
 * валидирует, опц. создаёт CAPA / Telegram alert.
 *
 * Это «быстрый ввод» для демо-сценария — без перехода в матричные
 * journal-документы (которые остаются для подробного режима).
 */

const JOURNAL_FORMS: Record<
  string,
  { fields: Field[]; submitLabel: string }
> = {
  cold_equipment_control: {
    submitLabel: "Завершить",
    fields: [
      { key: "temperature", label: "Температура (°C)", type: "number", required: true, placeholder: "напр. 4" },
      { key: "correctiveAction", label: "Корректирующее действие (если вне нормы)", type: "text", placeholder: "коротко описать" },
    ],
  },
  climate_control: {
    submitLabel: "Завершить",
    fields: [
      { key: "temperature", label: "Температура воздуха (°C)", type: "number", required: true },
      { key: "humidity", label: "Влажность (%)", type: "number", required: true },
    ],
  },
  fryer_oil: {
    submitLabel: "Завершить",
    fields: [
      { key: "temperatureC", label: "Температура жира (°C)", type: "number", required: true },
      { key: "polarCompoundsPercent", label: "Полярные соединения (%)", type: "number", placeholder: "если есть прибор" },
      { key: "colorAcceptable", label: "Цвет приемлемый", type: "checkbox" },
      { key: "replaced", label: "Заменил масло", type: "checkbox" },
    ],
  },
  incoming_control: {
    submitLabel: "Записать приёмку",
    fields: [
      { key: "supplier", label: "Поставщик", type: "text", required: true },
      { key: "productName", label: "Товар", type: "text", required: true },
      { key: "expirationDate", label: "Срок годности", type: "date" },
      { key: "temperature", label: "Температура (°C)", type: "number", placeholder: "для скоропорта" },
      { key: "quantity", label: "Количество", type: "text", placeholder: "напр. 5 кг / 12 шт" },
      { key: "accepted", label: "Принято", type: "checkbox" },
      { key: "rejectionReason", label: "Причина отказа (если не принято)", type: "text" },
    ],
  },
  finished_product: {
    submitLabel: "Записать бракераж",
    fields: [
      { key: "dish", label: "Блюдо / партия", type: "text", required: true },
      { key: "appearanceOk", label: "Внешний вид соответствует", type: "checkbox" },
      { key: "tasteOk", label: "Вкус соответствует", type: "checkbox" },
      { key: "temperature", label: "Температура подачи (°C)", type: "number" },
      { key: "correctiveAction", label: "Замечания / корректирующее действие", type: "text" },
    ],
  },
  disinfectant_usage: {
    submitLabel: "Завершить",
    fields: [
      { key: "disinfectantName", label: "Дезсредство", type: "text", required: true },
      { key: "concentration", label: "Концентрация", type: "text", placeholder: "напр. 0.1%" },
      { key: "volumeLiters", label: "Объём (литров)", type: "number" },
      { key: "purpose", label: "Назначение / зона", type: "text" },
    ],
  },
  accident_journal: {
    submitLabel: "Записать ЧП",
    fields: [
      { key: "description", label: "Что произошло", type: "text", required: true },
      { key: "severity", label: "Серьёзность (low/medium/high)", type: "text" },
      { key: "actionTaken", label: "Принятые меры", type: "text" },
    ],
  },
  complaint_register: {
    submitLabel: "Записать жалобу",
    fields: [
      { key: "complaintText", label: "Текст жалобы", type: "text", required: true },
      { key: "source", label: "Источник (телефон/сайт/посетитель)", type: "text" },
      { key: "actionTaken", label: "Принятые меры", type: "text" },
    ],
  },
  hygiene: {
    submitLabel: "Завершить осмотр",
    fields: [
      { key: "allHealthy", label: "Все сотрудники допущены", type: "checkbox" },
      { key: "notes", label: "Примечания", type: "text" },
    ],
  },
  health_check: {
    submitLabel: "Завершить",
    fields: [
      { key: "allHealthy", label: "Все сотрудники в норме", type: "checkbox" },
      { key: "notes", label: "Примечания", type: "text" },
    ],
  },
  cleaning: {
    submitLabel: "Завершить уборку",
    fields: [
      { key: "completedSteps", label: "Что сделано (через запятую)", type: "text", placeholder: "пол, поверхности, тех. инвентарь" },
      { key: "notes", label: "Замечания", type: "text" },
    ],
  },
  breakdown_history: {
    submitLabel: "Записать поломку",
    fields: [
      { key: "equipmentName", label: "Оборудование", type: "text", required: true },
      { key: "description", label: "Что сломалось", type: "text", required: true },
      { key: "actionTaken", label: "Что сделано", type: "text" },
    ],
  },
  ppe_issuance: {
    submitLabel: "Записать выдачу СИЗ",
    fields: [
      { key: "ppeName", label: "Тип СИЗ", type: "text", required: true, placeholder: "перчатки/халат/маска" },
      { key: "recipient", label: "Кому выдано", type: "text", required: true },
      { key: "quantity", label: "Количество", type: "number" },
    ],
  },
  glass_items_list: {
    submitLabel: "Записать",
    fields: [
      { key: "itemName", label: "Наименование", type: "text", required: true },
      { key: "material", label: "Материал (стекло/пластик/керамика)", type: "text" },
      { key: "quantity", label: "Количество", type: "number" },
      { key: "location", label: "Место хранения", type: "text" },
    ],
  },
  glass_control: {
    submitLabel: "Завершить контроль",
    fields: [
      { key: "checkedItems", label: "Что проверено", type: "text", required: true, placeholder: "стаканы, тарелки, посуда" },
      { key: "damaged", label: "Найдены повреждения", type: "checkbox" },
      { key: "actionTaken", label: "Действия (если повреждения)", type: "text" },
    ],
  },
  metal_impurity: {
    submitLabel: "Записать контроль",
    fields: [
      { key: "productName", label: "Продукт", type: "text", required: true },
      { key: "batchNumber", label: "Номер партии", type: "text" },
      { key: "metalDetected", label: "Металл обнаружен", type: "checkbox" },
      { key: "actionTaken", label: "Действия", type: "text" },
    ],
  },
  perishable_rejection: {
    submitLabel: "Записать утилизацию",
    fields: [
      { key: "productName", label: "Продукт", type: "text", required: true },
      { key: "quantity", label: "Количество", type: "text" },
      { key: "reason", label: "Причина (просрочка/повреждение/др.)", type: "text", required: true },
      { key: "disposalMethod", label: "Способ утилизации", type: "text" },
    ],
  },
  product_writeoff: {
    submitLabel: "Записать списание",
    fields: [
      { key: "productName", label: "Продукт", type: "text", required: true },
      { key: "quantity", label: "Количество", type: "text", required: true },
      { key: "costRub", label: "Стоимость, ₽", type: "number" },
      { key: "reason", label: "Причина", type: "text", required: true },
    ],
  },
  traceability_test: {
    submitLabel: "Завершить проверку",
    fields: [
      { key: "productBatch", label: "Партия / продукт", type: "text", required: true },
      { key: "supplier", label: "Поставщик", type: "text" },
      { key: "destinationTraced", label: "Прослежен путь до потребителя", type: "checkbox" },
      { key: "notes", label: "Замечания", type: "text" },
    ],
  },
  general_cleaning: {
    submitLabel: "Завершить генуборку",
    fields: [
      { key: "areaName", label: "Помещение / зона", type: "text", required: true },
      { key: "completedSteps", label: "Что сделано", type: "text", required: true },
      { key: "controllerName", label: "Контролёр", type: "text" },
    ],
  },
  sanitation_day_control: {
    submitLabel: "Завершить",
    fields: [
      { key: "completedSteps", label: "Что сделано", type: "text", required: true },
      { key: "notes", label: "Замечания", type: "text" },
    ],
  },
  sanitary_day_control: {
    submitLabel: "Завершить",
    fields: [
      { key: "completedSteps", label: "Что сделано", type: "text", required: true },
      { key: "notes", label: "Замечания", type: "text" },
    ],
  },
  pest_control: {
    submitLabel: "Завершить обработку",
    fields: [
      { key: "treatmentType", label: "Тип обработки (дератизация/дезинсекция)", type: "text", required: true },
      { key: "agent", label: "Применённое средство", type: "text" },
      { key: "areaTreated", label: "Обработанная зона", type: "text" },
      { key: "contractorName", label: "Подрядчик / специалист", type: "text" },
    ],
  },
  intensive_cooling: {
    submitLabel: "Завершить охлаждение",
    fields: [
      { key: "productName", label: "Продукт", type: "text", required: true },
      { key: "startTemp", label: "Температура старт (°C)", type: "number" },
      { key: "endTemp", label: "Температура конец (°C)", type: "number" },
      { key: "durationMinutes", label: "Время охлаждения, мин", type: "number" },
    ],
  },
  uv_lamp_runtime: {
    submitLabel: "Завершить",
    fields: [
      { key: "runtimeHours", label: "Наработка часов (с прошлой проверки)", type: "number", required: true },
      { key: "totalHours", label: "Общий ресурс, ч", type: "number" },
      { key: "lampOk", label: "Лампа исправна", type: "checkbox" },
      { key: "notes", label: "Замечания", type: "text" },
    ],
  },
  equipment_maintenance: {
    submitLabel: "Записать обслуживание",
    fields: [
      { key: "equipmentName", label: "Оборудование", type: "text", required: true },
      { key: "workType", label: "Тип работ (плановое/внеплановое)", type: "text" },
      { key: "description", label: "Что сделано", type: "text", required: true },
      { key: "performerName", label: "Исполнитель", type: "text" },
    ],
  },
  equipment_calibration: {
    submitLabel: "Записать поверку",
    fields: [
      { key: "equipmentName", label: "Прибор", type: "text", required: true },
      { key: "method", label: "Метод поверки", type: "text" },
      { key: "result", label: "Результат (годен/не годен)", type: "text" },
      { key: "nextDate", label: "Следующая поверка", type: "date" },
    ],
  },
  equipment_cleaning: {
    submitLabel: "Завершить чистку",
    fields: [
      { key: "equipmentName", label: "Оборудование", type: "text", required: true },
      { key: "method", label: "Метод чистки", type: "text" },
      { key: "agent", label: "Моющее/санит. средство", type: "text" },
      { key: "rinseTemp", label: "Температура ополаскивания (°C)", type: "number" },
    ],
  },
  audit_plan: {
    submitLabel: "Сохранить план",
    fields: [
      { key: "topic", label: "Тема аудита", type: "text", required: true },
      { key: "date", label: "Дата проведения", type: "date" },
      { key: "responsible", label: "Ответственный", type: "text" },
    ],
  },
  audit_protocol: {
    submitLabel: "Сохранить протокол",
    fields: [
      { key: "auditTopic", label: "Тема", type: "text", required: true },
      { key: "findings", label: "Выявленные нарушения", type: "text" },
      { key: "auditorName", label: "Аудитор", type: "text" },
    ],
  },
  audit_report: {
    submitLabel: "Сохранить отчёт",
    fields: [
      { key: "summary", label: "Резюме", type: "text", required: true },
      { key: "actions", label: "Корректирующие действия", type: "text" },
      { key: "nextAuditDate", label: "Дата следующего аудита", type: "date" },
    ],
  },
  training_plan: {
    submitLabel: "Записать выполнение",
    fields: [
      { key: "topic", label: "Тема обучения", type: "text", required: true },
      { key: "completedBy", label: "Прошёл (ФИО)", type: "text" },
      { key: "score", label: "Результат", type: "text" },
    ],
  },
};

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "checkbox" | "date";
  required?: boolean;
  placeholder?: string;
};

export default function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<{ message: string }[]>([]);
  const [skipMode, setSkipMode] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [pipeline, setPipeline] = useState<{
    intro?: string;
    steps: Array<{
      id: string;
      title: string;
      instruction?: string;
      checklist?: string[];
      requirePhoto?: boolean;
    }>;
  } | null>(null);
  const [pipelineProgress, setPipelineProgress] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/journal-task-claims/my", { cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { claim: Claim | null };
        if (j.claim && j.claim.id === id) {
          setClaim(j.claim);
          // Параллельно — pipeline для этого journalCode (если есть).
          fetch(`/api/journal-pipelines/${j.claim.journalCode}`, {
            cache: "force-cache",
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((p) => {
              if (p?.pipeline) setPipeline(p.pipeline);
            })
            .catch(() => null);
        } else {
          setError("Не нашёл активную задачу с этим ID. Возможно, она уже завершена.");
        }
      }
    })();
  }, [id]);

  const form = claim ? JOURNAL_FORMS[claim.journalCode] : null;

  async function submit() {
    if (!claim) return;

    // Клиент-side проверка required-полей. Сотрудник без опыта работы
    // с PC не должен видеть «Ошибка валидации: temperature: required»
    // от сервера — он не поймёт что это значит. Подсветим конкретное
    // поле названием на русском и сразу.
    if (form && (!pipeline || pipeline.steps.length === 0)) {
      const missing = form.fields
        .filter((f) => f.required)
        .filter((f) => {
          const v = data[f.key];
          if (f.type === "checkbox") return false; // checkbox required не используем
          return v === undefined || v === null || v === "";
        });
      if (missing.length > 0) {
        setError(`Заполни поле: «${missing[0].label}»`);
        return;
      }
      // Также ловим NaN — пользователь ввёл буквы вместо чисел.
      const badNumber = form.fields.find(
        (f) => f.type === "number" && typeof data[f.key] === "number" && Number.isNaN(data[f.key] as number)
      );
      if (badNumber) {
        setError(`В поле «${badNumber.label}» нужно число, не буквы.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      // Если pipeline — используем прогресс шагов как data; иначе — form data.
      const payload =
        pipeline && pipeline.steps.length > 0
          ? {
              pipelineCompleted: true,
              steps: pipeline.steps.map((s) => ({
                id: s.id,
                title: s.title,
                done: Boolean(pipelineProgress[s.id]),
                checklist: (s.checklist ?? []).map((item, i) => ({
                  item,
                  done: Boolean(pipelineProgress[`${s.id}::cl::${i}`]),
                })),
              })),
              ...data,
            }
          : data;
      const res = await fetch(`/api/journal-task-claims/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", data: payload }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        const errs = j?.errors as { field?: string; message: string }[] | undefined;
        const msg = errs?.map((e) => e.message).join("; ") || j?.reason || "Ошибка";
        throw new Error(msg);
      }
      setWarnings(j?.warnings ?? []);
      // Через 1 сек возвращаемся на /mini/today
      setTimeout(() => router.push("/mini/today"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function skipTask() {
    if (!claim) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/journal-task-claims/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "skip",
          skipReason: skipReason.trim() || "Сегодня не требуется",
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.reason || "Ошибка");
      }
      setTimeout(() => router.push("/mini/today"), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !claim) {
    return (
      <div className="space-y-3">
        <Link href="/mini/today" className="inline-flex items-center gap-1.5 text-[13px] text-[#6f7282]">
          <ArrowLeft className="size-4" />
          Сегодня
        </Link>
        <div className="rounded-2xl border border-[#ffd2cd] bg-[#fff4f2] p-4 text-[14px] text-[#a13a32]">
          {error}
        </div>
      </div>
    );
  }
  if (!claim) {
    return (
      <div className="flex h-40 items-center justify-center text-[#6f7282]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <Link href="/mini/today" className="inline-flex items-center gap-1.5 text-[13px] text-[#6f7282]">
        <ArrowLeft className="size-4" />
        Сегодня
      </Link>

      <header className="rounded-3xl border border-[#5566f6]/30 bg-[#eef1ff] p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#5566f6] text-white">
            <Thermometer className="size-5" />
          </span>
          <div>
            <div className="text-[12px] uppercase tracking-[0.14em] text-[#3848c7]">
              В работе
            </div>
            <div className="text-[18px] font-semibold leading-tight text-[#0b1024]">
              {claim.scopeLabel}
            </div>
          </div>
        </div>
      </header>

      {/* Pipeline — пошаговая инструкция. Имеет приоритет над form. */}
      {pipeline && pipeline.steps.length > 0 ? (
        <div className="space-y-3">
          {pipeline.intro ? (
            <div className="rounded-2xl border border-[#dcdfed] bg-[#fafbff] p-3 text-[13px] text-[#3c4053]">
              {pipeline.intro}
            </div>
          ) : null}
          <div className="relative space-y-3 pl-4">
            <div
              className="absolute left-[19px] top-2 bottom-2 w-px"
              style={{ background: "#dcdfed" }}
            />
            {pipeline.steps.map((step, idx) => {
              const done = Boolean(pipelineProgress[step.id]);
              return (
                <div
                  key={step.id}
                  className={`relative ml-4 rounded-2xl border p-4 transition-colors ${
                    done
                      ? "border-[#c8f0d5] bg-[#ecfdf5]"
                      : "border-[#dcdfed] bg-white"
                  }`}
                >
                  <div
                    className={`absolute -left-[24px] top-4 flex size-8 items-center justify-center rounded-full text-[12px] font-bold ${
                      done
                        ? "bg-[#136b2a] text-white"
                        : "bg-[#5566f6] text-white"
                    }`}
                  >
                    {done ? "✓" : idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPipelineProgress((p) => ({ ...p, [step.id]: !p[step.id] }))
                    }
                    className="block w-full text-left"
                  >
                    <div className="text-[15px] font-semibold leading-tight text-[#0b1024]">
                      {step.title}
                    </div>
                    {step.instruction ? (
                      <div className="mt-1 text-[13px] leading-relaxed text-[#3c4053]">
                        {step.instruction}
                      </div>
                    ) : null}
                  </button>
                  {step.checklist && step.checklist.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {step.checklist.map((item, i) => {
                        const itemKey = `${step.id}::cl::${i}`;
                        const itemDone = Boolean(pipelineProgress[itemKey]);
                        return (
                          <li key={i} className="flex items-start gap-2 text-[13px]">
                            <input
                              type="checkbox"
                              checked={itemDone}
                              onChange={() =>
                                setPipelineProgress((p) => ({
                                  ...p,
                                  [itemKey]: !p[itemKey],
                                }))
                              }
                              className="mt-0.5 size-4 shrink-0 accent-[#5566f6]"
                            />
                            <span
                              className={
                                itemDone
                                  ? "text-[#136b2a] line-through"
                                  : "text-[#0b1024]"
                              }
                            >
                              {item}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {step.requirePhoto ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#fff8eb] px-2.5 py-1 text-[11px] text-[#a13a32]">
                      📷 Требуется фото
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-3 text-[12px] text-[#6f7282]">
            Когда все шаги выполнены — нажми «Завершить» внизу.
          </div>
        </div>
      ) : form ? (
        <div className="space-y-3">
          {form.fields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={data[f.key]}
              onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-4 text-[13px] text-[#6f7282]">
          Для этого журнала нет быстрой формы — нажмите «Завершить» чтобы
          закрыть задачу. Подробное заполнение — в дашборде.
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-[#ffd2cd] bg-[#fff4f2] p-3 text-[13px] text-[#a13a32]">
          <AlertTriangle className="mr-1.5 inline size-4 align-text-bottom" />
          {error}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="rounded-2xl border border-[#ffe9b0] bg-[#fff8eb] p-3 text-[13px] text-[#a13a32]">
          <AlertTriangle className="mr-1.5 inline size-4 align-text-bottom" />
          {warnings.map((w) => w.message).join(" · ")}
        </div>
      ) : null}

      {skipMode ? (
        <div className="space-y-3 rounded-2xl border border-[#ffe9b0] bg-[#fff8eb] p-4">
          <div className="text-[14px] font-medium text-[#0b1024]">
            Сегодня не требуется заполнять?
          </div>
          <input
            type="text"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Причина (например: поставщик не приехал)"
            className="h-11 w-full rounded-xl border border-[#dcdfed] bg-white px-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSkipMode(false)}
              disabled={submitting}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-[#dcdfed] bg-white text-[13px] text-[#3c4053]"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={skipTask}
              disabled={submitting}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#a13a32] text-[13px] font-medium text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <SkipForward className="size-3.5" />}
              Пропустить
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[15px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {form?.submitLabel || "Завершить"}
          </button>
          <button
            type="button"
            onClick={() => setSkipMode(true)}
            disabled={submitting}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white text-[13px] text-[#6f7282]"
          >
            <SkipForward className="size-3.5" />
            Сегодня не требуется
          </button>
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 rounded-2xl border border-[#dcdfed] bg-white px-4 py-3 text-[15px]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="size-5 accent-[#5566f6]"
        />
        <span className="text-[#0b1024]">{field.label}</span>
      </label>
    );
  }
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-[#6f7282]">
        {field.label}
        {field.required ? <span className="ml-1 text-[#a13a32]">*</span> : null}
      </label>
      <input
        type={field.type}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          if (field.type === "number") {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v.replace(",", ".")));
          } else {
            onChange(e.target.value);
          }
        }}
        placeholder={field.placeholder}
        inputMode={field.type === "number" ? "decimal" : undefined}
        className="h-12 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none"
      />
    </div>
  );
}
