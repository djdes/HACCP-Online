"use client";

import { type ReactNode, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DateField,
  FloatingInputField,
  FloatingLabelField,
} from "@/components/journals/journal-dialog-field";
import {
  JOURNAL_DIALOG_ACTIONS_CLASS,
  JOURNAL_DIALOG_BODY_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_ERROR_CLASS,
  JOURNAL_DIALOG_FIELDS_CLASS,
  JOURNAL_DIALOG_FOOTER_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_SUBMIT_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
} from "@/components/journals/journal-responsive";
import {
  COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE,
  getColdEquipmentCreatePeriodBounds,
  getColdEquipmentDocumentTitle,
} from "@/lib/cold-equipment-document";
import {
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  getClimateCreatePeriodBounds,
  getClimateDocumentTitle,
} from "@/lib/climate-document";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  CLEANING_PAGE_TITLE,
  defaultCleaningDocumentConfig,
  getCleaningCreatePeriodBounds,
  getCleaningDocumentTitle,
} from "@/lib/cleaning-document";
import {
  FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE,
  getFinishedProductCreatePeriodBounds,
  getFinishedProductDocumentTitle,
} from "@/lib/finished-product-document";
import {
  ACCEPTANCE_DOCUMENT_TEMPLATE_CODE,
  getAcceptanceDocumentDefaultConfig,
} from "@/lib/acceptance-document";
import {
  getRegisterDocumentCreatePeriodBounds,
  getRegisterDocumentTitle,
  isRegisterDocumentTemplate,
} from "@/lib/register-document";
import {
  getHealthDocumentTitle,
  getHygieneCreatePeriodBounds,
  getHygieneDocumentTitle,
  getHygienePositionLabel,
} from "@/lib/hygiene-document";
import { isStaffDocumentTemplate } from "@/lib/journal-document-helpers";
import { ControlPeriodicityField } from "@/components/journals/control-periodicity-field";
import { getDefaultControlPeriodicity } from "@/lib/control-periodicity";
import { CreateDocumentEmptyState } from "@/components/journals/create-document-empty-state";
import { PositionEmployeePicker } from "@/components/shared/position-select";
import {
  getTrackedDocumentCreateMode,
  getTrackedDocumentTitle,
  isSourceStyleTrackedTemplate,
} from "@/lib/tracked-document";
import {
  UV_LAMP_RUNTIME_TEMPLATE_CODE,
  buildUvRuntimeDocumentTitle,
  defaultUvSpecification,
} from "@/lib/uv-lamp-runtime-document";
import {
  MED_BOOK_TEMPLATE_CODE,
  MED_BOOK_DOCUMENT_TITLE,
} from "@/lib/med-book-document";
import {
  PERISHABLE_REJECTION_TEMPLATE_CODE,
  PERISHABLE_REJECTION_DOCUMENT_TITLE,
  getPerishableRejectionCreatePeriodBounds,
} from "@/lib/perishable-rejection-document";
import {
  PRODUCT_WRITEOFF_DOCUMENT_TITLE,
  PRODUCT_WRITEOFF_TEMPLATE_CODE,
  getProductWriteoffCreatePeriodBounds,
} from "@/lib/product-writeoff-document";
import {
  STAFF_TRAINING_TEMPLATE_CODE,
  STAFF_TRAINING_DOCUMENT_TITLE,
  getStaffTrainingCreatePeriodBounds,
} from "@/lib/staff-training-document";
import {
  FRYER_OIL_TEMPLATE_CODE,
  defaultFryerOilDocumentConfig,
} from "@/lib/fryer-oil-document";
import {
  EQUIPMENT_MAINTENANCE_TEMPLATE_CODE,
  EQUIPMENT_MAINTENANCE_DOCUMENT_TITLE,
  getMaintenanceCreatePeriodBounds,
} from "@/lib/equipment-maintenance-document";
import {
  EQUIPMENT_CALIBRATION_TEMPLATE_CODE,
  EQUIPMENT_CALIBRATION_DOCUMENT_TITLE,
  getCalibrationCreatePeriodBounds,
} from "@/lib/equipment-calibration-document";
import {
  SANITARY_DAY_CHECKLIST_TEMPLATE_CODE,
  defaultSdcConfig,
} from "@/lib/sanitary-day-checklist-document";
import {
  EQUIPMENT_CLEANING_TEMPLATE_CODE,
  EQUIPMENT_CLEANING_VARIANT_LABELS,
  getDefaultEquipmentCleaningConfig,
  getEquipmentCleaningCreatePeriodBounds,
  getEquipmentCleaningDocumentTitle,
  type EquipmentCleaningFieldVariant,
} from "@/lib/equipment-cleaning-document";

interface Props {
  templateCode: string;
  templateName: string;
  users: {
    id: string;
    name: string;
    role: string;
    positionTitle?: string | null;
    jobPosition?: { name: string; categoryKey: string } | null;
  }[];
  triggerClassName?: string;
  triggerLabel?: string;
  triggerIcon?: ReactNode;
}

export function CreateDocumentDialog({
  templateCode,
  templateName,
  users,
  triggerClassName,
  triggerLabel = "Создать документ",
  triggerIcon,
}: Props) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const defaultPeriod = useMemo(
    () =>
      templateCode === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE
        ? getColdEquipmentCreatePeriodBounds()
        : templateCode === CLIMATE_DOCUMENT_TEMPLATE_CODE
          ? getClimateCreatePeriodBounds()
          : templateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
            ? getCleaningCreatePeriodBounds()
            : templateCode === FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE
              ? getFinishedProductCreatePeriodBounds()
              : templateCode === EQUIPMENT_MAINTENANCE_TEMPLATE_CODE
                ? getMaintenanceCreatePeriodBounds()
              : templateCode === EQUIPMENT_CALIBRATION_TEMPLATE_CODE
                ? getCalibrationCreatePeriodBounds()
              : templateCode === STAFF_TRAINING_TEMPLATE_CODE
                ? getStaffTrainingCreatePeriodBounds()
              : templateCode === PERISHABLE_REJECTION_TEMPLATE_CODE
                ? getPerishableRejectionCreatePeriodBounds()
                : templateCode === EQUIPMENT_CLEANING_TEMPLATE_CODE
                  ? getEquipmentCleaningCreatePeriodBounds()
                : templateCode === PRODUCT_WRITEOFF_TEMPLATE_CODE
                  ? getProductWriteoffCreatePeriodBounds()
                : isRegisterDocumentTemplate(templateCode)
                ? getRegisterDocumentCreatePeriodBounds()
                : getHygieneCreatePeriodBounds(),
    [templateCode]
  );

  const isStaffJournal = isStaffDocumentTemplate(templateCode);
  const isCleaningJournal = templateCode === CLEANING_DOCUMENT_TEMPLATE_CODE;
  const isClimateJournal = templateCode === CLIMATE_DOCUMENT_TEMPLATE_CODE;
  const isColdEquipmentJournal = templateCode === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE;
  const isSourceStyleTrackedJournal = isSourceStyleTrackedTemplate(templateCode);
  const isAcceptanceJournal = templateCode === ACCEPTANCE_DOCUMENT_TEMPLATE_CODE;
  const isUvRuntimeJournal = templateCode === UV_LAMP_RUNTIME_TEMPLATE_CODE;
  const isMedBookJournal = templateCode === MED_BOOK_TEMPLATE_CODE;
  const isPerishableRejectionJournal = templateCode === PERISHABLE_REJECTION_TEMPLATE_CODE;
  const isEquipmentCleaningJournal = templateCode === EQUIPMENT_CLEANING_TEMPLATE_CODE;
  const isProductWriteoffJournal = templateCode === PRODUCT_WRITEOFF_TEMPLATE_CODE;
  const isStaffTrainingJournal = templateCode === STAFF_TRAINING_TEMPLATE_CODE;
  const isEquipmentMaintenanceJournal = templateCode === EQUIPMENT_MAINTENANCE_TEMPLATE_CODE;
  const isEquipmentCalibrationJournal = templateCode === EQUIPMENT_CALIBRATION_TEMPLATE_CODE;
  /**
   * «График и учет генеральных уборок» — ГОДОВОЙ документ (см.
   * `YEARLY_JOURNAL_CODES` в `journal-period.ts`): период всегда
   * 1 января — 31 декабря. Поэтому «Дата окончания» в диалоге не нужна,
   * а должность + ФИО ответственного из каскада уходят в блок
   * «УТВЕРЖДАЮ» бланка (`approveRole` / `approveEmployee`).
   */
  const isGeneralCleaningJournal = templateCode === "general_cleaning";
  const trackedCreateMode = getTrackedDocumentCreateMode(templateCode);
  /**
   * Поле «Название документа» есть ВЕЗДЕ и всегда первое (эталон
   * cleaning-02b): раньше climate_control и cold_equipment_control
   * открывались вообще без него и владелец не понимал, что создаётся.
   */
  const showDateFields = !isColdEquipmentJournal;

  const [title, setTitle] = useState(
    templateCode === "hygiene"
      ? getHygieneDocumentTitle()
      : templateCode === "health_check"
        ? getHealthDocumentTitle()
        : templateCode === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE
          ? getColdEquipmentDocumentTitle()
          : templateCode === CLIMATE_DOCUMENT_TEMPLATE_CODE
            ? getClimateDocumentTitle()
            : templateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
              ? getCleaningDocumentTitle()
              : templateCode === FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE
                ? getFinishedProductDocumentTitle()
                : templateCode === EQUIPMENT_MAINTENANCE_TEMPLATE_CODE
                  ? EQUIPMENT_MAINTENANCE_DOCUMENT_TITLE
                : templateCode === EQUIPMENT_CALIBRATION_TEMPLATE_CODE
                  ? EQUIPMENT_CALIBRATION_DOCUMENT_TITLE
                : templateCode === STAFF_TRAINING_TEMPLATE_CODE
                  ? STAFF_TRAINING_DOCUMENT_TITLE
                : templateCode === PERISHABLE_REJECTION_TEMPLATE_CODE
                  ? PERISHABLE_REJECTION_DOCUMENT_TITLE
                : templateCode === PRODUCT_WRITEOFF_TEMPLATE_CODE
                  ? PRODUCT_WRITEOFF_DOCUMENT_TITLE
                : templateCode === EQUIPMENT_CLEANING_TEMPLATE_CODE
                  ? getEquipmentCleaningDocumentTitle()
                : templateCode === MED_BOOK_TEMPLATE_CODE
                  ? MED_BOOK_DOCUMENT_TITLE
                : isSourceStyleTrackedJournal
                  ? getTrackedDocumentTitle(templateCode)
                  : isRegisterDocumentTemplate(templateCode)
                    ? getRegisterDocumentTitle(templateCode)
                    : templateName
  );
  const [dateFrom, setDateFrom] = useState(defaultPeriod.dateFrom);
  const [dateTo, setDateTo] = useState(defaultPeriod.dateTo);
  const [responsibleUserId, setResponsibleUserId] = useState("");
  /**
   * Должность НЕ предзаполняем: раньше сюда падала первая должность из
   * списка (в uv_lamp_runtime это был «Кондитер»), и владелец создавал
   * документ на случайного человека, не заметив подстановки.
   * Дефолт селекта — «Выберите должность».
   */
  const [responsibleTitle, setResponsibleTitle] = useState("");
  const [trackedAreaName, setTrackedAreaName] = useState("");
  const [trackedLampNumber, setTrackedLampNumber] = useState("1");
  const [fpFieldNameMode, setFpFieldNameMode] = useState<"dish" | "semi">("dish");
  const [fpInspectorMode, setFpInspectorMode] = useState<"inspector_name" | "commission_signatures">(
    "inspector_name"
  );
  const [fpShowProductTemp, setFpShowProductTemp] = useState(false);
  const [fpShowCorrectiveAction, setFpShowCorrectiveAction] = useState(false);
  const [fpShowOxygenLevel, setFpShowOxygenLevel] = useState(false);
  const [fpShowCourierTime, setFpShowCourierTime] = useState(false);
  const [fpFooterNote, setFpFooterNote] = useState("");
  const [medBookIncludeVaccinations, setMedBookIncludeVaccinations] = useState(true);
  const [productWriteoffActNumber, setProductWriteoffActNumber] = useState("1");
  const [productWriteoffComment, setProductWriteoffComment] = useState("");
  const [equipmentCleaningVariant, setEquipmentCleaningVariant] =
    useState<EquipmentCleaningFieldVariant>("rinse_temperature");
  const [cleaningVentilation] = useState(true);
  // «Периодичность контроля» — редактируемая с самого создания (эталон
  // печатает её в шапке документа). Дефолт берём из реестра по коду журнала.
  const [controlPeriodicity, setControlPeriodicity] = useState(() =>
    getDefaultControlPeriodicity(templateCode)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const selectedResponsibleUser =
        (isAcceptanceJournal ? responsibleUserId : "") ||
        responsibleUserId ||
        users.find((user) =>
          isStaffJournal || isSourceStyleTrackedJournal || isCleaningJournal
            ? getHygienePositionLabel(user.role) === responsibleTitle
            : false
        )?.id;

      const res = await fetch("/api/journal-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCode,
          title: isUvRuntimeJournal
            ? buildUvRuntimeDocumentTitle({
                lampNumber: trackedLampNumber.trim() || "1",
                areaName: trackedAreaName.trim() || "Журнал учета работы",
                spec: defaultUvSpecification(),
              })
            : title.trim(),
          dateFrom,
          dateTo,
          responsibleUserId: selectedResponsibleUser || undefined,
          responsibleTitle: responsibleTitle || undefined,
          controlPeriodicity,
          config: isCleaningJournal
            ? {
                ...defaultCleaningDocumentConfig(users),
                ventilationEnabled: cleaningVentilation,
              }
            : isEquipmentCleaningJournal
            ? {
                ...getDefaultEquipmentCleaningConfig(),
                fieldVariant: equipmentCleaningVariant,
              }
            : isEquipmentMaintenanceJournal
            ? { year: Number(dateFrom.slice(0, 4)), documentDate: dateFrom }
            : isEquipmentCalibrationJournal
            ? { year: Number(dateFrom.slice(0, 4)), documentDate: dateFrom, rows: [], approveRole: responsibleTitle || "Управляющий", approveEmployee: "" }
            : isGeneralCleaningJournal
            ? {
                year: Number(dateFrom.slice(0, 4)),
                documentDate: dateFrom,
                approveRole: responsibleTitle || "Управляющий",
                approveEmployeeId: selectedResponsibleUser || null,
                approveEmployee:
                  users.find((user) => user.id === selectedResponsibleUser)?.name || "",
                responsibleRole: responsibleTitle || "Управляющий",
                responsibleEmployeeId: selectedResponsibleUser || null,
                responsibleEmployee:
                  users.find((user) => user.id === selectedResponsibleUser)?.name || "",
              }
            : isStaffTrainingJournal
            ? { showSignatureField: medBookIncludeVaccinations }
            : isMedBookJournal
            ? {
                includeVaccinations: medBookIncludeVaccinations,
              }
            : isAcceptanceJournal
              ? {
                  ...getAcceptanceDocumentDefaultConfig(users),
                  showPackagingComplianceField: fpShowCorrectiveAction,
                  defaultResponsibleTitle: responsibleTitle || null,
                  defaultResponsibleUserId: selectedResponsibleUser || null,
                }
              : templateCode === FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE
              ? {
                  fieldNameMode: fpFieldNameMode,
                  inspectorMode: fpInspectorMode,
                  showProductTemp: fpShowProductTemp,
                  showCorrectiveAction: fpShowCorrectiveAction,
                  showOxygenLevel: fpShowOxygenLevel,
                  showCourierTime: fpShowCourierTime,
                  footerNote: fpFooterNote.trim(),
                }
            : templateCode === FRYER_OIL_TEMPLATE_CODE
              ? defaultFryerOilDocumentConfig()
              : templateCode === PRODUCT_WRITEOFF_TEMPLATE_CODE
              ? {
                  documentName: title.trim() || PRODUCT_WRITEOFF_DOCUMENT_TITLE,
                  actNumber: productWriteoffActNumber || "1",
                  documentDate: dateFrom,
                  comment: productWriteoffComment,
                }
              : templateCode === SANITARY_DAY_CHECKLIST_TEMPLATE_CODE
              ? defaultSdcConfig()
              : isSourceStyleTrackedJournal && (trackedAreaName.trim() || isUvRuntimeJournal)
                ? isUvRuntimeJournal
                  ? {
                      lampNumber: trackedLampNumber.trim() || "1",
                      areaName: trackedAreaName.trim() || "Журнал учета работы",
                      spec: defaultUvSpecification(),
                    }
                  : { areaName: trackedAreaName.trim() }
                : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка создания");
      }

      const { document: doc } = await res.json();
      setOpen(false);
      router.push(`/journals/${templateCode}/documents/${doc.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Компактный (source-style) набор полей. Раньше флаг заодно менял
   * ширину/паддинги/кегль заголовка — теперь геометрия у всех диалогов
   * ОДНА (JOURNAL_DIALOG_* токены), флаг отвечает только за состав полей.
   */
  const isCompactSourceModal =
    isStaffJournal ||
    isSourceStyleTrackedJournal ||
    isMedBookJournal ||
    isPerishableRejectionJournal ||
    isProductWriteoffJournal ||
    isStaffTrainingJournal ||
    isEquipmentMaintenanceJournal ||
    isEquipmentCalibrationJournal ||
    isCleaningJournal ||
    isEquipmentCleaningJournal;
  /**
   * Каскад «Должность → Сотрудник». Журналы, у которых ответственный
   * задаётся не при создании (медкнижки, списания, обучение, ТО/поверка,
   * уборка оборудования), каскад не показывают.
   *
   * perishable_rejection каскад ПОКАЗЫВАЕТ: в карточке списка и в шапке
   * документа есть «Ответственный», а задать его было негде.
   */
  const showResponsiblePicker =
    !isMedBookJournal &&
    !isProductWriteoffJournal &&
    !isStaffTrainingJournal &&
    !isEquipmentMaintenanceJournal &&
    !isEquipmentCalibrationJournal &&
    !isCleaningJournal &&
    !isEquipmentCleaningJournal;
  const showDateTo =
    !isClimateJournal && !isColdEquipmentJournal && !isGeneralCleaningJournal;
  /**
   * Период у «штатных» журналов (гигиена, здоровье, контроль гигиены рук)
   * считается автоматически на 15 дней — поля даты у них нет. Раньше на
   * это место вставлялась серая плашка-объяснялка; на эталоне её нет,
   * и она только удлиняла окно.
   */
  const usesAutoPeriod = isStaffJournal || trackedCreateMode === "staff";
  const showCompactDateFrom =
    !usesAutoPeriod && !isMedBookJournal && !isCleaningJournal;
  // Онбординг-гейт: без сотрудников создавать документ нечему —
  // не будет ни ответственного, ни строк. Показываем инструкцию.
  const hasNoEmployees = users.length === 0;

  const trigger = (
    <DialogTrigger asChild>
      <Button className={cn(triggerClassName)}>
        {triggerIcon || <Plus className="size-4" />}
        {triggerLabel}
      </Button>
    </DialogTrigger>
  );

  const header = (
    <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
      {/* Заголовок ВСЕГДА короткий: название журнала и так предзаполнено
          в первом поле, а «Создать документ: <длинное имя>» ломалось
          на 2-3 строки. */}
      <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
        Создание документа
      </DialogTitle>
    </DialogHeader>
  );

  if (hasNoEmployees) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger}
        <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
          {header}
          <div className={JOURNAL_DIALOG_BODY_CLASS}>
            <CreateDocumentEmptyState onNavigate={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const responsiblePicker = (
    <PositionEmployeePicker
      users={users}
      value={{ positionTitle: responsibleTitle, userId: responsibleUserId }}
      onChange={(next) => {
        setResponsibleTitle(next.positionTitle);
        setResponsibleUserId(next.userId);
      }}
      positionLabel="Должность ответственного"
      employeeLabel="Ответственный"
      variant="floating"
    />
  );

  const periodicityAndSubmit = (
    <>
      <ControlPeriodicityField
        value={controlPeriodicity}
        onChange={setControlPeriodicity}
      />

    </>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        {header}

        <form
          id={formId}
          onSubmit={handleSubmit}
          className={cn(JOURNAL_DIALOG_BODY_CLASS, JOURNAL_DIALOG_FIELDS_CLASS)}
        >
          {error && <p className={JOURNAL_DIALOG_ERROR_CLASS}>{error}</p>}

          {isCompactSourceModal ? (
            <>
              {trackedCreateMode === "uv" ? (
                <>
                  <FloatingInputField
                    id="uv-lamp-number"
                    label="Бактерицидная установка №"
                    value={trackedLampNumber}
                    onChange={setTrackedLampNumber}
                    required
                  />
                  <FloatingInputField
                    id="tracked-area-name"
                    label="Наименование цеха/участка применения"
                    value={trackedAreaName}
                    onChange={setTrackedAreaName}
                  />
                </>
              ) : (
                <FloatingInputField
                  id="doc-title"
                  label="Название документа"
                  value={title}
                  onChange={setTitle}
                  required
                />
              )}

              {isMedBookJournal && (
                <label className="flex items-center gap-3 text-[14px] text-[#3c4053]">
                  <Checkbox
                    checked={medBookIncludeVaccinations}
                    onCheckedChange={(checked) =>
                      setMedBookIncludeVaccinations(checked === true)
                    }
                  />
                  Включить раздел «Прививки»
                </label>
              )}

              {showCompactDateFrom && (
                <DateField
                  id="compact-date-from"
                  label="Дата начала"
                  value={dateFrom}
                  onChange={(value) => {
                    setDateFrom(value);
                    if (isEquipmentCleaningJournal) setDateTo(value);
                  }}
                />
              )}

              {(isEquipmentMaintenanceJournal || isEquipmentCalibrationJournal) && (
                <FloatingLabelField label="Год" htmlFor="doc-year">
                  <select
                    id="doc-year"
                    value={dateFrom.slice(0, 4)}
                    onChange={(e) => setDateFrom(`${e.target.value}-01-01`)}
                    className="h-7 w-full border-0 bg-transparent p-0 text-[15px] text-[#0b1024] outline-none"
                  >
                    {Array.from({ length: 10 }, (_, i) =>
                      String(new Date().getFullYear() - 3 + i)
                    ).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </FloatingLabelField>
              )}

              {isEquipmentCleaningJournal && (
                <FloatingLabelField label="Колонка контроля">
                  <div className="flex flex-col gap-2 pt-1 text-[14px] text-[#0b1024]">
                    {(
                      Object.keys(
                        EQUIPMENT_CLEANING_VARIANT_LABELS
                      ) as EquipmentCleaningFieldVariant[]
                    ).map((variant) => (
                      <label key={variant} className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          checked={equipmentCleaningVariant === variant}
                          onChange={() => setEquipmentCleaningVariant(variant)}
                          className="size-4 accent-[#5566f6]"
                        />
                        {EQUIPMENT_CLEANING_VARIANT_LABELS[variant]}
                      </label>
                    ))}
                  </div>
                </FloatingLabelField>
              )}

              {isProductWriteoffJournal && (
                <>
                  <FloatingInputField
                    id="product-writeoff-act-number"
                    label="№ акта"
                    value={productWriteoffActNumber}
                    onChange={setProductWriteoffActNumber}
                    required
                  />
                  <FloatingInputField
                    id="product-writeoff-comment"
                    label="Комментарий"
                    value={productWriteoffComment}
                    onChange={setProductWriteoffComment}
                  />
                </>
              )}

              {isStaffTrainingJournal && (
                <label className="flex items-center gap-3 text-[14px] text-[#3c4053]">
                  <Checkbox
                    checked={medBookIncludeVaccinations}
                    onCheckedChange={(checked) =>
                      setMedBookIncludeVaccinations(checked === true)
                    }
                  />
                  Добавить поле «Подпись инструктируемого»
                </label>
              )}

              {showResponsiblePicker && responsiblePicker}

              {isAcceptanceJournal && (
                <label className="flex items-center gap-3 text-[14px] text-[#3c4053]">
                  <Checkbox
                    checked={fpShowCorrectiveAction}
                    onCheckedChange={(checked) =>
                      setFpShowCorrectiveAction(checked === true)
                    }
                  />
                  Добавить «Соответствие внешнего вида упаковки, маркировки
                  требованиям НД»
                </label>
              )}

              {periodicityAndSubmit}
            </>
          ) : (
            <>
              <FloatingInputField
                id="doc-title-main"
                label="Название документа"
                value={title}
                onChange={setTitle}
                required
              />

              {showDateFields && (
                <>
                  <DateField
                    id="doc-from"
                    label="Дата начала"
                    value={dateFrom}
                    onChange={setDateFrom}
                  />
                  {showDateTo && (
                    <DateField
                      id="doc-to"
                      label="Дата окончания"
                      value={dateTo}
                      onChange={setDateTo}
                    />
                  )}
                </>
              )}

              {!isCleaningJournal && responsiblePicker}

              {isCleaningJournal && (
                <p className="text-[13px] leading-[1.4] text-[#6f7282]">
                  Ответственных за уборку и контроль можно настроить внутри
                  документа.
                </p>
              )}

              {templateCode === FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE && (
                <>
                  {/* Раньше обе радиогруппы назывались «Название поля» —
                      различить их было нельзя. */}
                  <FloatingLabelField label="Колонка наименования">
                    <div className="flex flex-col gap-2 pt-1 text-[14px] text-[#0b1024]">
                      <label className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          checked={fpFieldNameMode === "dish"}
                          onChange={() => setFpFieldNameMode("dish")}
                          className="size-4 accent-[#5566f6]"
                        />
                        Наименование блюд (изделий)
                      </label>
                      <label className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          checked={fpFieldNameMode === "semi"}
                          onChange={() => setFpFieldNameMode("semi")}
                          className="size-4 accent-[#5566f6]"
                        />
                        Наименование полуфабриката
                      </label>
                    </div>
                  </FloatingLabelField>

                  <FloatingLabelField label="Добавить поля">
                    <div className="flex flex-col gap-2 pt-1 text-[14px] text-[#0b1024]">
                      <label className="flex items-center gap-2.5">
                        <Checkbox
                          checked={fpShowProductTemp}
                          onCheckedChange={(checked) =>
                            setFpShowProductTemp(checked === true)
                          }
                        />
                        Т°С внутри продукта и корректирующие действия
                      </label>
                      <label className="flex items-center gap-2.5">
                        <Checkbox
                          checked={fpShowCorrectiveAction}
                          onCheckedChange={(checked) =>
                            setFpShowCorrectiveAction(checked === true)
                          }
                        />
                        Примечание
                      </label>
                      <label className="flex items-center gap-2.5">
                        <Checkbox
                          checked={fpShowOxygenLevel}
                          onCheckedChange={(checked) =>
                            setFpShowOxygenLevel(checked === true)
                          }
                        />
                        Остаточный уровень кислорода, % об.
                      </label>
                      <label className="flex items-center gap-2.5">
                        <Checkbox
                          checked={fpShowCourierTime}
                          onCheckedChange={(checked) =>
                            setFpShowCourierTime(checked === true)
                          }
                        />
                        Время передачи блюд курьеру
                      </label>
                    </div>
                  </FloatingLabelField>

                  <FloatingLabelField label="Кто подписывает">
                    <div className="flex flex-col gap-2 pt-1 text-[14px] text-[#0b1024]">
                      <label className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          checked={fpInspectorMode === "inspector_name"}
                          onChange={() => setFpInspectorMode("inspector_name")}
                          className="size-4 accent-[#5566f6]"
                        />
                        ФИО лица, проводившего бракераж
                      </label>
                      <label className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          checked={fpInspectorMode === "commission_signatures"}
                          onChange={() =>
                            setFpInspectorMode("commission_signatures")
                          }
                          className="size-4 accent-[#5566f6]"
                        />
                        Подписи членов бракеражной комиссии
                      </label>
                    </div>
                  </FloatingLabelField>

                  <FloatingInputField
                    label="Примечание"
                    value={fpFooterNote}
                    onChange={setFpFooterNote}
                    placeholder="Печатается под таблицей"
                  />
                </>
              )}

              {periodicityAndSubmit}
            </>
          )}
        </form>
        {/* Футер вне скролл-зоны: тело диалога скроллится (max-h-[90vh]),
            и кнопка внутри него уезжала за экран на длинных формах.
            Сабмит остаётся через нативный submit — кнопка привязана к
            форме атрибутом form=. */}
        <div className={JOURNAL_DIALOG_FOOTER_CLASS}>
          <div className={JOURNAL_DIALOG_ACTIONS_CLASS}>
            <Button
              type="submit"
              form={formId}
              disabled={isSubmitting}
              className={JOURNAL_DIALOG_SUBMIT_CLASS}
            >
              {isSubmitting ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
