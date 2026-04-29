/**
 * Smart presets для назначения должностей-ответственных за журналы.
 * Используется и на сервере (apply-presets API), и на клиенте (UI кнопки).
 *
 * Каждое правило: набор `journalCodes` + набор `positionKeywords`.
 * Для каждого кода вычисляем: какие позиции из текущей орги матчат
 * keyword'ы по имени → они становятся ответственными за этот журнал.
 *
 * Если у журнала ни одна позиция не подошла (например, в орге нет
 * «уборщицы»), журнал пропускается — не дефолтим в «всем». В таком
 * случае админу нужно либо завести должность с подходящим именем,
 * либо проставить руками.
 */
export type ResponsiblePreset = {
  /** Internal id для UI */
  id: string;
  /** Человекочитаемый label */
  label: string;
  /** Краткое описание для подсказки */
  description: string;
  /** Какие журналы попадают под это правило */
  journalCodes: readonly string[];
  /** По имени должности — ищем по подстроке (lowercase) */
  positionKeywords: readonly string[];
};

export const RESPONSIBLE_PRESETS: readonly ResponsiblePreset[] = [
  {
    id: "cleaning-to-cleaners",
    label: "Уборка → уборщикам",
    description:
      "Все журналы уборки и санитарии — на сотрудников клининга",
    journalCodes: [
      "cleaning",
      "general_cleaning",
      "cleaning_ventilation_checklist",
      "sanitary_day_checklist",
      "sanitation_day",
      "uv_lamp_runtime",
      "disinfectant_usage",
      "equipment_cleaning",
    ],
    positionKeywords: ["уборщ", "клинер", "клининг", "санитар"],
  },
  {
    id: "temperature-to-cooks",
    label: "Температура → поварам",
    description: "Контроль холода, климата, фритюра — у кухни",
    journalCodes: [
      "climate_control",
      "cold_equipment_control",
      "intensive_cooling",
      "fryer_oil",
      "finished_product",
      "perishable_rejection",
    ],
    positionKeywords: ["повар", "шеф", "кух", "технолог", "су-шеф"],
  },
  {
    id: "intake-to-storekeepers",
    label: "Приёмка → товароведам",
    description:
      "Входной контроль, приёмка сырья, прослеживаемость",
    journalCodes: [
      "incoming_control",
      "incoming_raw_materials_control",
      "metal_impurity",
      "traceability_test",
      "supplier_audit",
    ],
    positionKeywords: ["товаровед", "кладов", "снабж", "приём"],
  },
  {
    id: "health-to-everyone",
    label: "Здоровье и гигиена → всем",
    description:
      "Гигиенический журнал, здоровье, медкнижки — заполняют все",
    journalCodes: ["hygiene", "health_check", "med_books"],
    positionKeywords: [],
  },
  {
    id: "equipment-to-maintainers",
    label: "Оборудование → техникам",
    description:
      "Калибровка, ТО, поломки, стекло — у инженеров и техобслуги",
    journalCodes: [
      "equipment_calibration",
      "equipment_maintenance",
      "breakdown_history",
      "glass_control",
      "glass_items_list",
    ],
    positionKeywords: ["техник", "инженер", "механик", "слесар"],
  },
  {
    id: "training-to-managers",
    label: "Обучение → руководителям",
    description:
      "План обучения, инструктажи — на менеджмент",
    journalCodes: [
      "training_plan",
      "training_attendance",
      "training_attestation",
      "instruction_attendance",
    ],
    positionKeywords: ["менеджер", "управляющ", "директор", "заведующ"],
  },
  {
    id: "incidents-to-managers",
    label: "Несчастные случаи → руководителям",
    description:
      "Аварии, жалобы, инциденты — у директора и менеджмента",
    journalCodes: [
      "accident_journal",
      "complaint_register",
      "audit_plan",
      "audit_protocol",
      "audit_report",
    ],
    positionKeywords: ["менеджер", "управляющ", "директор", "заведующ"],
  },
] as const;

/**
 * Применить ВСЕ пресеты к набору позиций.
 * Возвращает Map<journalCode, Set<positionId>>: для какого журнала
 * какие позиции должны стать ответственными.
 *
 * Если для журнала ни одна позиция не подошла — он не попадает в
 * результат (значит, оставляем как есть; не стираем существующее).
 */
export function computePresetAssignments(
  positions: ReadonlyArray<{ id: string; name: string }>
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const preset of RESPONSIBLE_PRESETS) {
    const matchedPositionIds: string[] = [];
    for (const p of positions) {
      const lower = p.name.toLowerCase();
      if (preset.positionKeywords.length === 0) {
        // «всем» — но только сотрудникам, не всем-всем. Если правило
        // «health-to-everyone» — кладём все позиции. Но это слишком
        // громко: оставим только если у позиции имя содержит хоть
        // одну из «работа-на-кухне» меток. Иначе health-журналы попадут
        // даже на admin'а / директора, что странно. Решение: keywords=[]
        // → всех, без фильтра. Админ может потом снять.
        matchedPositionIds.push(p.id);
        continue;
      }
      if (preset.positionKeywords.some((kw) => lower.includes(kw))) {
        matchedPositionIds.push(p.id);
      }
    }
    if (matchedPositionIds.length === 0) continue;
    for (const code of preset.journalCodes) {
      const set = result.get(code) ?? new Set<string>();
      for (const pid of matchedPositionIds) set.add(pid);
      result.set(code, set);
    }
  }
  return result;
}
