"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Wifi, Loader2 } from "lucide-react";
import { getJournalSpec } from "@/lib/journal-specs";
import {
  isFormInDeviation,
  getDeviationHint,
} from "@/lib/journal-deviation-rules";
import { JournalGuide } from "@/components/journals/journal-guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FieldHint, FieldWarning } from "./field-hint";
import { retryFetch } from "@/lib/retry-fetch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoCapture, type OcrResult } from "./photo-capture";
import { VoiceInput } from "./voice-input";

type FieldOption = { value: string; label: string };
type ShowIfCondition = { field: string; equals: unknown };

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean" | "select" | "equipment" | "employee";
  required?: boolean;
  options?: FieldOption[];
  step?: number;
  auto?: boolean;
  showIf?: ShowIfCondition;
};

type EquipmentItem = {
  id: string;
  name: string;
  type: string;
  tempMin: number | null;
  tempMax: number | null;
  tuyaDeviceId?: string | null;
};

type AreaItem = {
  id: string;
  name: string;
};

type EmployeeItem = {
  id: string;
  name: string;
  role?: string | null;
};

type ProductItem = {
  id: string;
  name: string;
  supplier: string | null;
  barcode: string | null;
  unit: string;
  storageTemp: string | null;
  shelfLifeDays: number | null;
};

interface DynamicFormProps {
  templateCode: string;
  templateName: string;
  fields: FieldDef[];
  areas: AreaItem[];
  equipment: EquipmentItem[];
  employees?: EmployeeItem[];
  products?: ProductItem[];
  /**
   * Root of the journal URL space for post-save + cancel navigation. Defaults
   * to `/journals` (the dashboard surface). Mini App callers pass
   * `/mini/journals` so the redirect stays inside the Mini App shell.
   */
  journalsBasePath?: string;
  /**
   * Phase R: distribution=rolling. Если true — рендерим две кнопки
   * сохранения: «Сохранить и продолжить» (создаёт следующую TF-задачу
   * и сбрасывает форму) и «Готово на сегодня» (закрывает loop и
   * редиректит как обычно). `dailyCountInitial` — сколько rolling-
   * задач этот сотрудник уже создал за сегодня (для счётчика).
   */
  rollingMode?: boolean;
  dailyCountInitial?: number;
  rollingDailyCap?: number;
  rollingContinueLabel?: string;
  rollingDoneLabel?: string;
  /**
   * P1.5 wave-c — кастомный гайд организации (узлы из
   * `JournalGuideNode[]` в порядке tree-flatten). Загружается в
   * page.tsx через `loadGuideTree`. Передаётся в `<JournalGuide>`
   * который заменит ими legacy `guide.steps`.
   */
  customGuideNodes?: Array<{
    title: string;
    detail: string | null;
    photoUrl: string | null;
  }>;
}

export function DynamicForm({
  templateCode,
  templateName: _templateName,
  fields,
  areas,
  equipment,
  employees = [],
  products = [],
  journalsBasePath = "/journals",
  customGuideNodes,
  rollingMode = false,
  dailyCountInitial = 0,
  rollingDailyCap = 50,
  rollingContinueLabel = "Сохранить и продолжить",
  rollingDoneLabel = "Готово на сегодня",
}: DynamicFormProps) {
  void _templateName;
  const router = useRouter();
  // Phase B: Conditional required fields. Используем journal-spec для
  // поиска полей которые становятся обязательными при отклонении +
  // правила определения «отклонения» из journal-deviation-rules.
  const journalSpec = useMemo(
    () => getJournalSpec(templateCode),
    [templateCode],
  );
  const conditionallyRequiredKeys = useMemo<Set<string>>(
    () => new Set(journalSpec.conditionalRequiredOnDeviation ?? []),
    [journalSpec],
  );
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [areaId, setAreaId] = useState<string>("");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [catalogProductId, setCatalogProductId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<
    "default" | "rolling-continue" | "rolling-done"
  >("default");
  const [error, setError] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(dailyCountInitial);
  const [rollingNotice, setRollingNotice] = useState<string | null>(null);
  const [isFetchingSensor, setIsFetchingSensor] = useState(false);
  const [sensorInfo, setSensorInfo] = useState<{
    temperature: number;
    humidity: number | null;
    timestamp: string;
  } | null>(null);

  const selectedEquipment = equipment.find((e) => e.id === equipmentId);
  const hasSensor = !!selectedEquipment?.tuyaDeviceId;
  const selectedCatalogProduct = products.find((p) => p.id === catalogProductId);
  const isJournal7to9 =
    templateCode === "pest_control" ||
    templateCode === "equipment_calibration" ||
    templateCode === "product_writeoff";

  // Check if this template supports photo OCR or product catalog
  const supportsPhotoOcr = templateCode === "incoming_control";
  const supportsProductCatalog =
    products.length > 0 &&
    (templateCode === "incoming_control" ||
      templateCode === "finished_product" ||
      templateCode === "product_writeoff" ||
      templateCode === "cooking_temp" ||
      templateCode === "shipment");

  useEffect(() => {
    if (templateCode !== "pest_control") return;
    setFormData((prev) => ({
      ...prev,
      eventType: prev.eventType ?? "disinsection",
      method: prev.method ?? "chemical",
      result: prev.result ?? "effective",
    }));
  }, [templateCode]);

  useEffect(() => {
    if (templateCode !== "product_writeoff") return;
    setFormData((prev) => ({
      ...prev,
      reason: prev.reason ?? "expired",
      disposalMethod: prev.disposalMethod ?? "disposal",
    }));
  }, [templateCode]);

  useEffect(() => {
    if (templateCode !== "equipment_calibration") return;
    const today = new Date().toISOString().slice(0, 10);
    setFormData((prev) => ({
      ...prev,
      calibrationType: prev.calibrationType ?? "verification",
      calibrationDate: prev.calibrationDate ?? today,
      result: prev.result ?? "passed",
    }));
  }, [templateCode]);

  useEffect(() => {
    if (templateCode !== "equipment_calibration") return;
    const calibrationDateValue = formData.calibrationDate;
    if (typeof calibrationDateValue !== "string" || calibrationDateValue.length < 10) return;
    if (!selectedEquipment) return;

    const baseDate = new Date(calibrationDateValue);
    if (Number.isNaN(baseDate.getTime())) return;

    const next = new Date(baseDate);
    const monthsDelta = selectedEquipment.type === "thermometer" ? 24 : 12;
    next.setMonth(next.getMonth() + monthsDelta);

    setFormData((prev) => ({
      ...prev,
      nextCalibrationDate: next.toISOString().slice(0, 10),
    }));
  }, [templateCode, formData.calibrationDate, selectedEquipment]);

  function updateField(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function updateMultipleFields(updates: Record<string, unknown>) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  function isFieldVisible(field: FieldDef): boolean {
    if (!field.showIf) return true;
    return formData[field.showIf.field] === field.showIf.equals;
  }

  async function fetchFromSensor() {
    if (!equipmentId) return;
    setIsFetchingSensor(true);
    setError(null);
    setSensorInfo(null);

    try {
      const res = await fetch(
        `/api/tuya/device?equipmentId=${equipmentId}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка получения данных с датчика");
      }

      updateField("temperature", data.temperature);
      updateField("source", "tuya_sensor");

      setSensorInfo({
        temperature: data.temperature,
        humidity: data.humidity,
        timestamp: data.timestamp,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка получения данных"
      );
    } finally {
      setIsFetchingSensor(false);
    }
  }

  // Handle OCR result — auto-fill form fields from photo
  function handleOcrResult(result: OcrResult) {
    const updates: Record<string, unknown> = {};

    if (result.productName) updates.productName = result.productName;
    if (result.supplier) updates.supplier = result.supplier;
    if (result.manufactureDate) updates.manufactureDate = result.manufactureDate;
    if (result.expiryDate) updates.expiryDate = result.expiryDate;
    if (result.quantity) updates.quantity = result.quantity;
    if (result.unit) updates.unit = result.unit;
    if (result.batchNumber) updates.batchNumber = result.batchNumber;

    // Save OCR metadata
    updates.ocrUsed = true;
    updates.ocrConfidence = result.confidence;
    if (result.barcode) updates.barcode = result.barcode;
    if (result.storageTemp) updates.storageTemp = result.storageTemp;
    if (result.composition) updates.composition = result.composition;

    updateMultipleFields(updates);
  }

  async function submitForm(continueRolling: boolean | null) {
    // Phase B: блокируем submit если форма в отклонении и
    // обязательные поля пустые. Это server-side тоже валидируется,
    // но перехват на client'е даёт мгновенный feedback.
    const inDev = isFormInDeviation(templateCode, formData);
    if (inDev) {
      const missing: string[] = [];
      for (const key of conditionallyRequiredKeys) {
        const v = formData[key];
        if (v === undefined || v === null || v === "") {
          const f = fields.find((x) => x.key === key);
          missing.push(f?.label ?? key);
        }
      }
      if (missing.length > 0) {
        setError(
          `Отклонение от нормы — обязательно заполни: ${missing.join(", ")}.`,
        );
        return;
      }
    }

    setIsSubmitting(true);
    setSubmittingMode(
      continueRolling === null
        ? "default"
        : continueRolling
          ? "rolling-continue"
          : "rolling-done",
    );
    setError(null);
    setRollingNotice(null);

    try {
      const response = await retryFetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCode,
          areaId: areaId || undefined,
          equipmentId: equipmentId || undefined,
          data: formData,
          // Rolling-флаг — если null, body.rolling вообще не уйдёт.
          ...(continueRolling !== null
            ? { rolling: { continue: continueRolling } }
            : {}),
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Ошибка при сохранении");
      }

      const result = await response.json().catch(() => ({}));
      const rollingMeta = result?.rolling as
        | {
            enabled: boolean;
            continued: boolean;
            capped?: boolean;
            dailyCount?: number;
            remaining?: number;
            reason?: string;
          }
        | undefined;

      if (
        rollingMode &&
        continueRolling === true &&
        rollingMeta?.continued
      ) {
        // Loop продолжается — НЕ редиректим, обнуляем форму, увеличиваем
        // счётчик. Сотрудник видит «За сегодня заполнено: N» и заполняет
        // следующую запись.
        const newCount =
          rollingMeta.dailyCount ?? dailyCount + 1;
        setDailyCount(newCount);
        setFormData({});
        setError(null);
        setRollingNotice(
          rollingMeta.remaining !== undefined && rollingMeta.remaining <= 5
            ? `Заполнено ${newCount}, осталось до лимита ${rollingMeta.remaining}.`
            : `Заполнено ${newCount}. Готов к следующей записи.`,
        );
        // Скроллим вверх чтобы пользователь увидел чистую форму.
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }

      if (rollingMode && continueRolling === true && rollingMeta?.capped) {
        setRollingNotice(
          `Достигнут лимит ${rollingDailyCap} записей в день. Запись сохранена, но новая задача не создана.`,
        );
        // Редиректим как «Готово на сегодня».
        router.push(`${journalsBasePath}/${templateCode}`);
        router.refresh();
        return;
      }

      // Не-rolling save или «Готово на сегодня» — обычный редирект.
      router.push(`${journalsBasePath}/${templateCode}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setIsSubmitting(false);
      setSubmittingMode("default");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Default form submit (Enter в input'е) — для rolling воспринимается
    // как «продолжить», для обычного — как save+redirect.
    await submitForm(rollingMode ? true : null);
  }

  // P2.A.5 — Ctrl+S / ⌘+S сохраняет форму. preventDefault'им browser
  // «save page», вызываем стандартный submit. Для rolling — продолжение
  // loop'а (как обычный submit), для не-rolling — save+redirect.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isSave = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;
      e.preventDefault();
      if (isSubmitting) return;
      // Тригерим submit, как если бы пользователь нажал кнопку «Сохранить».
      submitForm(rollingMode ? true : null).catch(() => {
        // ошибки уже обрабатываются в submitForm через toast
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // submitForm и rollingMode стабильны для жизни компонента; isSubmitting
    // нужен чтобы не дёргать дублирующий submit пока первый ещё в полёте.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitting, rollingMode]);

  const visibleFields = fields.filter(
    (field) => !field.auto && isFieldVisible(field)
  );

  // Phase B: detection of deviation. Если форма в отклонении — некоторые
  // поля становятся обязательными (из spec.conditionalRequiredOnDeviation),
  // и сверху показываем жёлтый alert с пояснением.
  const inDeviation = useMemo(
    () => isFormInDeviation(templateCode, formData),
    [templateCode, formData],
  );
  const deviationHint = inDeviation ? getDeviationHint(templateCode) : null;
  const deviationMissingFields = useMemo<string[]>(() => {
    if (!inDeviation) return [];
    const missing: string[] = [];
    for (const key of conditionallyRequiredKeys) {
      const v = formData[key];
      if (v === undefined || v === null || v === "") {
        // Найдём label для дружелюбного сообщения.
        const f = fields.find((x) => x.key === key);
        missing.push(f?.label ?? key);
      }
    }
    return missing;
  }, [inDeviation, conditionallyRequiredKeys, formData, fields]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sprint-compliance: гайд для нового сотрудника. Collapsible —
          если знакомый журнал, занимает 1 строчку. Если нет — раскрыл и
          увидел шаги по СанПиН. */}
      <JournalGuide
        journalCode={templateCode}
        customNodes={customGuideNodes}
      />

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Deviation banner — желтое предупреждение когда форма
          сигнализирует об отклонении нормы. Показывает требуемые
          поля чтобы повар не закрыл запись с пустыми. */}
      {inDeviation && deviationHint ? (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold leading-tight">
              Внимание: отклонение от нормы
            </div>
            <p className="mt-1 text-[13px] leading-snug">{deviationHint}</p>
            {deviationMissingFields.length > 0 ? (
              <div className="mt-2 rounded-xl border border-amber-300 bg-white/60 p-2 text-[12.5px]">
                <strong>Заполните обязательно:</strong>{" "}
                {deviationMissingFields.join(", ")}.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Photo OCR for incoming control */}
      {supportsPhotoOcr && (
        <div className="space-y-2">
          <Label>Распознать с фото</Label>
          <PhotoCapture onResult={handleOcrResult} />
        </div>
      )}

      {/* Product catalog quick-fill */}
      {supportsProductCatalog && (
        <div className="space-y-2">
          <Label>Выбрать из справочника</Label>
          <Select
            value={catalogProductId}
            onValueChange={(productId) => {
              setCatalogProductId(productId);
              const product = products.find((p) => p.id === productId);
              if (!product) return;
              const updates: Record<string, unknown> = {
                productName: product.name,
              };
              if (product.supplier) updates.supplier = product.supplier;
              if (product.unit) updates.unit = product.unit;
              if (templateCode === "product_writeoff" && formData.quantity == null) {
                updates.quantity = 1;
              }
              updateMultipleFields(updates);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Быстрый выбор из каталога..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                  {product.supplier && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {product.supplier}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {templateCode === "product_writeoff" && selectedCatalogProduct?.storageTemp && (
            <p className="text-[13px] text-muted-foreground">
              Температура хранения: {selectedCatalogProduct.storageTemp}
            </p>
          )}
        </div>
      )}

      {areas.length > 0 && !isJournal7to9 && (
        <div className="space-y-2">
          <Label htmlFor="area">Участок</Label>
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger id="area" className="w-full">
              <SelectValue placeholder="Выберите участок" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {visibleFields.map((field) => (
        <div key={field.key} className="space-y-2">
          {field.type === "boolean" ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id={field.key}
                checked={!!formData[field.key]}
                onCheckedChange={(checked) =>
                  updateField(field.key, checked === true)
                }
              />
              <Label htmlFor={field.key}>{field.label}</Label>
              <FieldHint templateCode={templateCode} fieldKey={field.key} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && (
                    <span className="text-destructive"> *</span>
                  )}
                </Label>
                <FieldHint templateCode={templateCode} fieldKey={field.key} />
              </div>

              {field.type === "text" && (
                <VoiceInput
                  id={field.key}
                  value={(formData[field.key] as string) ?? ""}
                  onChange={(v) => updateField(field.key, v)}
                  required={field.required}
                />
              )}

              {field.type === "number" && (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id={field.key}
                      type="number"
                      step={field.step ?? 1}
                      value={(formData[field.key] as string) ?? ""}
                      onChange={(e) =>
                        updateField(
                          field.key,
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      required={field.required}
                    />
                    {field.key === "temperature" && hasSensor && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fetchFromSensor}
                        disabled={isFetchingSensor}
                        className="shrink-0 sm:self-start"
                      >
                        {isFetchingSensor ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Wifi className="size-4" />
                        )}
                        {isFetchingSensor ? "Получение..." : "С датчика"}
                      </Button>
                    )}
                  </div>
                  <FieldWarning
                    templateCode={templateCode}
                    fieldKey={field.key}
                    value={formData[field.key] as number | undefined}
                  />
                  {sensorInfo && field.key === "temperature" && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium text-green-800">
                        <Wifi className="size-4" />
                        Данные получены с IoT-датчика
                      </div>
                      <div className="mt-2 space-y-1 text-green-700">
                        <p>
                          Температура:{" "}
                          <strong>{sensorInfo.temperature}°C</strong>
                        </p>
                        {sensorInfo.humidity !== null && (
                          <p>
                            Влажность:{" "}
                            <strong>{sensorInfo.humidity}%</strong>
                          </p>
                        )}
                        <p className="text-[13px] text-green-600">
                          {new Date(sensorInfo.timestamp).toLocaleString(
                            "ru-RU"
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {field.type === "date" && (
                <Input
                  id={field.key}
                  type="date"
                  value={(formData[field.key] as string) ?? ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  required={field.required}
                />
              )}

              {field.type === "select" && field.options && (
                <Select
                  value={(formData[field.key] as string) ?? ""}
                  onValueChange={(value) => updateField(field.key, value)}
                  required={field.required}
                >
                  <SelectTrigger id={field.key} className="w-full">
                    <SelectValue placeholder="Выберите..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {field.type === "equipment" && (
                <Select
                  value={equipmentId}
                  onValueChange={(value) => {
                    setEquipmentId(value);
                    updateField(field.key, value);
                    const eq = equipment.find((item) => item.id === value);
                    if (eq) updateField("equipmentName", eq.name);
                    setSensorInfo(null);
                  }}
                  required={field.required}
                >
                  <SelectTrigger id={field.key} className="w-full">
                    <SelectValue placeholder="Выберите оборудование" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                        {item.tuyaDeviceId && " (IoT)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {field.type === "employee" && (
                <Select
                  value={(formData[field.key] as string) ?? ""}
                  onValueChange={(value) => updateField(field.key, value)}
                  required={field.required}
                >
                  <SelectTrigger id={field.key} className="w-full">
                    <SelectValue placeholder="Выберите сотрудника" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
      ))}

      {rollingMode ? (
        <div className="rounded-2xl border border-[#5566f6]/20 bg-gradient-to-br from-[#f5f6ff] to-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#3848c7]">
                Цикл «пока не нажмёте Готово»
              </div>
              <div className="mt-1 text-[13px] leading-snug text-[#3c4053]">
                Заполните запись и жмите{" "}
                <strong className="text-[#3848c7]">«{rollingContinueLabel}»</strong>{" "}
                — система сразу создаст вам следующую такую же задачу.
                Когда закончите смену — нажмите{" "}
                <strong className="text-[#0b1024]">«{rollingDoneLabel}»</strong>.
              </div>
              {rollingNotice ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                  ✓ {rollingNotice}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12px] font-medium text-[#3848c7] ring-1 ring-[#5566f6]/15">
              За сегодня:{" "}
              <span className="tabular-nums text-[16px] font-semibold">
                {dailyCount}
              </span>
              <span className="text-[11px] text-[#9b9fb3]">
                / {rollingDailyCap}
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`${journalsBasePath}/${templateCode}`)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void submitForm(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {submittingMode === "rolling-done"
                ? "Сохранение..."
                : rollingDoneLabel}
            </Button>
            <Button
              type="button"
              onClick={() => void submitForm(true)}
              disabled={isSubmitting}
              className="w-full sm:flex-1"
            >
              {submittingMode === "rolling-continue"
                ? "Сохранение..."
                : rollingContinueLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Сохранение..." : "Сохранить запись"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`${journalsBasePath}/${templateCode}`)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Отмена
          </Button>
        </div>
      )}
    </form>
  );
}
