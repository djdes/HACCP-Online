/**
 * TasksFlow adapter for «Журнал температуры и влажности»
 * (climate_control).
 *
 * Climate entries pack many sub-values into `entry.data.measurements`:
 *   measurements[roomId][time][temperature|humidity] = number | null
 *
 * One TF task = one measurement run. The worker enters a temperature
 * (and optionally humidity) for every enabled room, tagged with the
 * nearest control-time slot from the document config. Re-completion
 * updates that slot in place so readiness doesn't flip back to «не
 * заполнено».
 *
 *   • adapter row  = employee (rowKey = `employee-<userId>`)
 *   • completion   = JournalDocumentEntry upsert for today, merging
 *                    the submitted values into `measurements[roomId]
 *                    [nearestControlTime]`.
 *   • form         = dynamic: per-room temp + humidity (if enabled
 *                    in document config), plus a select for which
 *                    control-time slot this run belongs to.
 */
import { db } from "@/lib/db";
import {
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  DEFAULT_CLIMATE_CONTROL_TIMES,
  normalizeClimateDocumentConfig,
  normalizeClimateEntryData,
  type ClimateDocumentConfig,
  type ClimateEntryData,
  type ClimateMeasurement,
} from "@/lib/climate-document";
import {
  EMPTY_SYNC_REPORT,
  type AdapterDocument,
  type AdapterRow,
  type JournalAdapter,
  type TaskSchedule,
} from "./types";
import type { TaskFormField, TaskFormSchema } from "./task-form";
import { extractEmployeeId as employeeIdFromRowKey, rowKeyForEmployee } from "./row-key";

const TEMPLATE_CODE = CLIMATE_DOCUMENT_TEMPLATE_CODE;
const toDateKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

function tempKey(roomId: string) {
  return `t_${roomId}`;
}
function humidityKey(roomId: string) {
  return `h_${roomId}`;
}

function buildForm(
  config: ClimateDocumentConfig,
  employeeName: string | null
): TaskFormSchema {
  const fields: TaskFormField[] = [];

  // Which control-time slot this measurement belongs to. Default = the
  // first configured time; admin's document config defines the list.
  const times = config.controlTimes.length
    ? config.controlTimes
    : [...DEFAULT_CLIMATE_CONTROL_TIMES];
  fields.push({
    type: "select",
    key: "controlTime",
    label: "Время замера",
    required: true,
    options: times.map((t) => ({ value: t, label: t })),
    defaultValue: times[0],
  });

  for (const room of config.rooms) {
    if (room.temperature.enabled) {
      const { min, max } = room.temperature;
      const rangeSuffix =
        typeof min === "number" && typeof max === "number"
          ? ` · норма ${min}…${max}`
          : "";
      fields.push({
        type: "number",
        key: tempKey(room.id),
        label: `${room.name} — t°${rangeSuffix}`,
        unit: "°C",
        min: -40,
        max: 60,
        step: 0.1,
        required: true,
      });
    }
    if (room.humidity.enabled) {
      const { min, max } = room.humidity;
      const rangeSuffix =
        typeof min === "number" && typeof max === "number"
          ? ` · норма ${min}…${max}`
          : "";
      fields.push({
        type: "number",
        key: humidityKey(room.id),
        label: `${room.name} — влажность${rangeSuffix}`,
        unit: "%",
        min: 0,
        max: 100,
        step: 1,
      });
    }
  }

  return {
    intro:
      (employeeName ? `${employeeName}, ` : "") +
      "снимите показания температуры (и влажности — где включено) по " +
      "каждому помещению и выберите время замера.",
    submitLabel: "Сохранить замер",
    fields,
  };
}

function pickNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export const climateAdapter: JournalAdapter = {
  meta: {
    templateCode: TEMPLATE_CODE,
    label: "Температура и влажность",
    description:
      "Замер температуры и влажности по помещениям в назначенное время.",
    iconName: "thermometer",
  },

  scheduleForRow(): TaskSchedule {
    return { weekDays: [0, 1, 2, 3, 4, 5, 6] };
  },

  titleForRow(row) {
    return `Климат · ${row.label}`;
  },

  descriptionForRow(_row, doc) {
    return [
      `Журнал: ${doc.documentTitle}`,
      `Период: ${doc.period.from} — ${doc.period.to}`,
      "Снимите показания по помещениям из списка в задаче.",
    ].join("\n");
  },

  async listDocumentsForOrg(organizationId): Promise<AdapterDocument[]> {
    const [docs, employees] = await Promise.all([
      db.journalDocument.findMany({
        where: {
          organizationId,
          status: "active",
          template: { code: TEMPLATE_CODE },
        },
        select: { id: true, title: true, dateFrom: true, dateTo: true },
        orderBy: { dateFrom: "desc" },
      }),
      db.user.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, role: true, positionTitle: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
    ]);
    return docs.map<AdapterDocument>((doc) => ({
      documentId: doc.id,
      documentTitle: doc.title,
      period: { from: toDateKey(doc.dateFrom), to: toDateKey(doc.dateTo) },
      rows: employees.map<AdapterRow>((emp) => ({
        rowKey: rowKeyForEmployee(emp.id),
        label: emp.name,
        sublabel: emp.positionTitle ?? undefined,
        responsibleUserId: emp.id,
      })),
    }));
  },

  async syncDocument() {
    return EMPTY_SYNC_REPORT;
  },

  async getTaskForm({ documentId, rowKey }) {
    const [doc, employee] = await Promise.all([
      db.journalDocument.findUnique({
        where: { id: documentId },
        select: { config: true },
      }),
      (async () => {
        const empId = employeeIdFromRowKey(rowKey);
        if (!empId) return null;
        return db.user.findUnique({
          where: { id: empId },
          select: { name: true },
        });
      })(),
    ]);
    if (!doc) return null;
    const config = normalizeClimateDocumentConfig(doc.config);
    return buildForm(config, employee?.name ?? null);
  },

  async applyRemoteCompletion({ documentId, rowKey, completed, todayKey, values }) {
    if (!completed) return false;
    const employeeId = employeeIdFromRowKey(rowKey);
    if (!employeeId) return false;
    const dateObj = new Date(`${todayKey}T00:00:00.000Z`);
    if (Number.isNaN(dateObj.getTime())) return false;

    const doc = await db.journalDocument.findUnique({
      where: { id: documentId },
      select: { config: true },
    });
    if (!doc) return false;
    const config = normalizeClimateDocumentConfig(doc.config);

    const times = config.controlTimes.length
      ? config.controlTimes
      : [...DEFAULT_CLIMATE_CONTROL_TIMES];
    const requestedTime =
      typeof values?.controlTime === "string" &&
      times.includes(values.controlTime)
        ? values.controlTime
        : times[0];

    // Preserve any previous measurements for other control-times /
    // rooms on the same day — overwrite only the requested slot.
    const existing = await db.journalDocumentEntry.findUnique({
      where: {
        documentId_employeeId_date: { documentId, employeeId, date: dateObj },
      },
      select: { data: true },
    });
    const currentData: ClimateEntryData = normalizeClimateEntryData(
      existing?.data ?? null
    );
    const measurements: Record<string, Record<string, ClimateMeasurement>> = {
      ...currentData.measurements,
    };

    for (const room of config.rooms) {
      const priorRoom = measurements[room.id] ?? {};
      const priorSlot: ClimateMeasurement =
        priorRoom[requestedTime] ?? { temperature: null, humidity: null };
      const nextTemp = room.temperature.enabled
        ? pickNumber(values?.[tempKey(room.id)])
        : priorSlot.temperature;
      const nextHum = room.humidity.enabled
        ? pickNumber(values?.[humidityKey(room.id)])
        : priorSlot.humidity;
      measurements[room.id] = {
        ...priorRoom,
        [requestedTime]: {
          temperature: nextTemp,
          humidity: nextHum,
        },
      };
    }

    const data: ClimateEntryData = {
      responsibleTitle: currentData.responsibleTitle,
      measurements,
    };

    await db.journalDocumentEntry.upsert({
      where: {
        documentId_employeeId_date: { documentId, employeeId, date: dateObj },
      },
      create: { documentId, employeeId, date: dateObj, data },
      update: { data },
    });
    return true;
  },
};
