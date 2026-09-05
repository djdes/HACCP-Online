import io
import re


def read(path):
    return io.open(path, encoding="utf-8").read()


def write(path, s):
    io.open(path, "w", encoding="utf-8", newline="\n").write(s)
    print("patched", path)


def apply(path, s, pairs):
    for old, new, count in pairs:
        n = s.count(old)
        assert n == count, f"{path}: expected {count} of {old[:90]!r}, found {n}"
        s = s.replace(old, new)
    return s


def patch(path, pairs):
    write(path, apply(path, read(path), pairs))


def add_import_after(s, anchor_regex, line, path):
    m = re.search(anchor_regex, s, re.M)
    assert m, f"{path}: import anchor {anchor_regex!r} not found"
    return s[: m.end()] + "\n" + line + s[m.end():]


# ---------- shared flag helper ----------
patch("src/lib/journal-document-shared.ts", [
    ('''export function withSharedFlag<T extends { buildingId?: string | null }>(''',
     '''export function sharedDocumentFlag(
  document: { buildingId?: string | null },
  list: ReadonlyArray<{ buildingId?: string | null }>,
): boolean {
  return !document.buildingId && list.some((item) => Boolean(item.buildingId));
}

export function withSharedFlag<T extends { buildingId?: string | null }>(''', 1),
])

# ---------- journals/[code]/page.tsx: shared flag in every list mapper ----------
p = "src/app/(dashboard)/journals/[code]/page.tsx"
s = read(p)
s = add_import_after(s, r'^import \{ buildingWhere \} from "@/lib/building-scope";$',
                     'import { sharedDocumentFlag } from "@/lib/journal-document-shared";', p)
pattern = re.compile(r"(documents=\{(\w+)\.map\(\((document|doc)\) => [\s\S]*?\n)(\s+)id: (document|doc)\.id,")
count = 0
def repl(m):
    global count
    count += 1
    return f"{m.group(1)}{m.group(4)}id: {m.group(5)}.id,\n{m.group(4)}shared: sharedDocumentFlag({m.group(5)}, {m.group(2)}),"
s = pattern.sub(repl, s)
print("mapper inserts:", count)
assert count >= 30, count
old = '''      return {
        id: document.id,
        title: document.title || getJournalDocumentDefaultTitle(resolvedCode),'''
n = s.count(old)
s = s.replace(old, '''      return {
        id: document.id,
        shared: sharedDocumentFlag(document, documents),
        title: document.title || getJournalDocumentDefaultTitle(resolvedCode),''')
print("mappedDocuments inserts:", n)
write(p, s)

# ---------- dashboard: per-location summary strip ----------
p = "src/app/(dashboard)/dashboard/page.tsx"
s = apply(p, read(p), [
    ('import { getActiveBuildingId } from "@/lib/active-building";',
     'import { getActiveBuildingId, loadBuildingContext } from "@/lib/active-building";\nimport { LocationsSummaryStrip } from "@/components/dashboard/locations-summary-strip";', 1),
    ('  const previewUrls = await getJournalPreviewMap(organizationId);',
     '  const previewUrls = await getJournalPreviewMap(organizationId, activeBuildingId);', 1),
    ('''  const unfilledCount = complianceItems.filter((c) => !c.filled).length;
  const filledCount = complianceItems.length - unfilledCount;''', '''  const unfilledCount = complianceItems.filter((c) => !c.filled).length;
  const filledCount = complianceItems.length - unfilledCount;
  // Точки: сводка по точкам — заполнено сегодня на каждой, клик переключает.
  const buildingContext = await loadBuildingContext(session);
  const locationItems = buildingContext.canSwitch
    ? await Promise.all(
        buildingContext.buildings.map(async (building) => {
          const filled =
            building.id === activeBuildingId
              ? filledTodayIds
              : await getTemplatesFilledToday(
                  organizationId,
                  now,
                  templates.map((t) => ({ id: t.id, code: t.code })),
                  disabledCodes,
                  { treatAperiodicAsFilled: false, buildingId: building.id }
                );
          return {
            id: building.id,
            name: building.name,
            address: building.address,
            filled: selectedEnabledTemplates.filter((t) => filled.has(t.id)).length,
            total: selectedEnabledTemplates.length,
            active: building.id === activeBuildingId,
          };
        })
      )
    : [];''', 1),
    ('''      <section className="space-y-4">
          {complianceItems.length > 0 && (''', '''      {locationItems.length >= 2 ? <LocationsSummaryStrip items={locationItems} /> : null}

      <section className="space-y-4">
          {complianceItems.length > 0 && (''', 1),
])
write(p, s)

# ---------- profile modal: naming step ----------
p = "src/components/dashboard/complete-profile-nudge.tsx"
s = read(p)
s = apply(p, s, [
    ('''  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);''', '''  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  // Точки: после «Готово» с двумя и более точками — шаг «Назовите точки».
  const [namingBuildings, setNamingBuildings] = useState<NamingBuilding[] | null>(null);
  const [namingSaving, setNamingSaving] = useState(false);''', 1),
    ('''  async function saveProfile(): Promise<boolean> {''',
     '''  async function saveProfile(): Promise<{ buildings?: Array<{ id: string; name: string; address: string | null }> } | null> {''', 1),
    ('''      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось сохранить",
      );
      return false;
    }
  }''', '''      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");
      return (data ?? {}) as { buildings?: Array<{ id: string; name: string; address: string | null }> };
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось сохранить",
      );
      return null;
    }
  }

  async function saveNaming() {
    if (!namingBuildings) return;
    setNamingSaving(true);
    try {
      for (const item of namingBuildings) {
        const name = item.name.trim();
        if (!name || (name === item.initialName && item.address.trim() === item.initialAddress)) continue;
        const res = await fetch(`/api/settings/buildings/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, address: item.address.trim() || null }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `Не удалось сохранить «${name}»`);
        }
      }
      toast.success("Точки названы — они уже в шапке и в меню");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setNamingSaving(false);
    }
  }''', 1),
    ('''    try {
      if (!(await saveProfile())) return;
      toast.success(savedMessage);
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }''', '''    try {
      const saved = await saveProfile();
      if (!saved) return;
      toast.success(savedMessage);
      const buildings = saved.buildings ?? [];
      if (buildings.length >= 2) {
        // Имена и адреса сразу: «Точка 1» иначе так и напечатается в PDF.
        setNamingBuildings(
          buildings.map((b) => ({
            id: b.id,
            name: b.name,
            address: b.address ?? "",
            initialName: b.name,
            initialAddress: b.address ?? "",
          })),
        );
        router.refresh();
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }''', 1),
    ('''    try {
      if (!(await saveProfile())) return;
      const res = await fetch("/api/organizations/demo", {''', '''    try {
      if (!(await saveProfile())) return;
      const res = await fetch("/api/organizations/demo", {''', 1),
    ('''              {welcome ? "Аккаунт создан!" : "Завершите регистрацию"}
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-[#6f7282]">
              Логин: <span className="text-[#3c4053]">{email}</span>
            </p>''', '''              {namingBuildings
                ? "Назовите точки"
                : welcome
                  ? "Аккаунт создан!"
                  : "Завершите регистрацию"}
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-[#6f7282]">
              {namingBuildings ? (
                "Названия и адреса печатаются в шапке журналов и PDF"
              ) : (
                <>
                  Логин: <span className="text-[#3c4053]">{email}</span>
                </>
              )}
            </p>''', 1),
    ('''        <form
          id="complete-profile-form"''', '''        {namingBuildings ? (
          <LocationNamingStep
            items={namingBuildings}
            saving={namingSaving}
            onChange={setNamingBuildings}
            onSkip={() => {
              onClose();
              router.refresh();
            }}
            onSave={() => void saveNaming()}
          />
        ) : (
          <>
        <form
          id="complete-profile-form"''', 1),
])
end_old = '''              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}'''
assert s.count(end_old) == 1, s.count(end_old)
s = s.replace(end_old, '''              Готово
            </button>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

type NamingBuilding = {
  id: string;
  name: string;
  address: string;
  initialName: string;
  initialAddress: string;
};

/**
 * Шаг «Назовите точки» после анкеты: строка на точку — название и адрес.
 * Компактно: две колонки, без подписей у полей (плейсхолдеры), «Позже»
 * рядом с «Сохранить» — всё в первом экране телефона при 2–4 точках,
 * дальше список прокручивается внутри окна.
 */
function LocationNamingStep({
  items,
  saving,
  onChange,
  onSkip,
  onSave,
}: {
  items: NamingBuilding[];
  saving: boolean;
  onChange: (next: NamingBuilding[]) => void;
  onSkip: () => void;
  onSave: () => void;
}) {
  const inputClass =
    "h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15";
  return (
    <>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-2 sm:px-5">
        {items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
            <input
              type="text"
              value={item.name}
              onChange={(e) =>
                onChange(items.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)))
              }
              placeholder={`Точка ${index + 1}`}
              aria-label={`Название точки ${index + 1}`}
              className={inputClass}
            />
            <input
              type="text"
              value={item.address}
              onChange={(e) =>
                onChange(items.map((it, i) => (i === index ? { ...it, address: e.target.value } : it)))
              }
              placeholder="Адрес"
              aria-label={`Адрес точки ${index + 1}`}
              className={inputClass}
            />
          </div>
        ))}
        <p className="text-[12px] leading-snug text-[#6f7282]">
          Сотрудники общие; кому с какой точки приходят задачи — в карточке сотрудника.
        </p>
      </div>
      <div className="shrink-0 border-t border-[#eef0f6] p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-[#dcdfed] bg-white text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            Позже
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || items.some((it) => !it.name.trim())}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[15px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Сохранить
          </button>
        </div>
      </div>
    </>
  );
}''')
write(p, s)

# ---------- buildings page: user building ids ----------
patch("src/app/(dashboard)/settings/buildings/page.tsx", [
    ('''        jobPosition: { select: { name: true } },
      },
    }),
    db.organization.findUnique({''', '''        jobPosition: { select: { name: true } },
        // Точки: кто где работает — для блока «Сотрудники точки».
        buildingIds: true,
      },
    }),
    db.organization.findUnique({''', 1),
    ('''        perLocationJournals={organization?.perLocationJournals === true}
        // Консультант уровня «просмотр» видит точки, но не меняет их:''', '''        perLocationJournals={organization?.perLocationJournals === true}
        userBuildingIds={Object.fromEntries(users.map((u) => [u.id, u.buildingIds]))}
        // Консультант уровня «просмотр» видит точки, но не меняет их:''', 1),
])

# ---------- buildings client: kpp/phone + staff of the point ----------
p = "src/app/(dashboard)/settings/buildings/buildings-client.tsx"
s = read(p)
s = apply(p, s, [
    ('import { Building2, Check, Copy, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";',
     'import { Building2, Check, Copy, MapPin, Pencil, Plus, Trash2, Users, X } from "lucide-react";', 1),
    ('''type Building = {
  id: string;
  name: string;
  address: string | null;''', '''type Building = {
  id: string;
  name: string;
  address: string | null;
  /** Точки: реквизиты для шапки PDF. */
  kpp?: string | null;
  phone?: string | null;''', 1),
    ('''  readOnly = false,
  unnamedCount = 0,
}: {
  initial: Building[];
  users: RoomResponsibleUser[];''', '''  readOnly = false,
  unnamedCount = 0,
  userBuildingIds = {},
}: {
  initial: Building[];
  users: RoomResponsibleUser[];
  /** Точки: id точек каждого сотрудника (пусто — работает везде). */
  userBuildingIds?: Record<string, string[]>;''', 1),
    ('''          readOnly={readOnly}
          donors={initial''', '''          readOnly={readOnly}
          perLocationJournals={perLocationJournals}
          users={users}
          userBuildingIds={userBuildingIds}
          donors={initial''', 1),
    ('''  readOnly?: boolean;
  /** Другие точки с помещениями — откуда можно скопировать справочник. */
  donors: Array<{ id: string; name: string; roomsCount: number }>;''', '''  readOnly?: boolean;
  perLocationJournals?: boolean;
  users: RoomResponsibleUser[];
  userBuildingIds: Record<string, string[]>;
  /** Другие точки с помещениями — откуда можно скопировать справочник. */
  donors: Array<{ id: string; name: string; roomsCount: number }>;''', 1),
    ('''  const [draftAddress, setDraftAddress] = useState(building.address ?? "");''',
     '''  const [draftAddress, setDraftAddress] = useState(building.address ?? "");
  const [draftKpp, setDraftKpp] = useState(building.kpp ?? "");
  const [draftPhone, setDraftPhone] = useState(building.phone ?? "");
  // Сотрудники точки: кто работает здесь (User.buildingIds содержит точку).
  const staffHere = users.filter((u) => (userBuildingIds[u.id] ?? []).includes(building.id));
  const staffEverywhere = users.filter((u) => (userBuildingIds[u.id] ?? []).length === 0);
  const [editingStaff, setEditingStaff] = useState(false);
  const [staffDraft, setStaffDraft] = useState<Set<string>>(() => new Set(staffHere.map((u) => u.id)));
  const [savingStaff, setSavingStaff] = useState(false);

  async function saveStaff() {
    setSavingStaff(true);
    try {
      const res = await fetch(`/api/settings/buildings/${building.id}/staff`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(staffDraft) }),
      });
      const d = (await res.json().catch(() => ({}))) as { changed?: number; error?: string };
      if (!res.ok) throw new Error(d?.error ?? "Не удалось сохранить");
      toast.success(d.changed ? `Обновлено сотрудников: ${d.changed}` : "Без изменений");
      setEditingStaff(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSavingStaff(false);
    }
  }''', 1),
    ('''        body: JSON.stringify({ name, address: draftAddress.trim() || null }),''',
     '''        body: JSON.stringify({
          name,
          address: draftAddress.trim() || null,
          kpp: draftKpp.trim() || null,
          phone: draftPhone.trim() || null,
        }),''', 1),
    ('''              placeholder="Адрес — печатается в шапке журналов"
              aria-label="Адрес точки"
              className="h-10 w-full rounded-xl border border-[#dcdfed] px-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />''', '''              placeholder="Адрес — печатается в шапке журналов"
              aria-label="Адрес точки"
              className="h-10 w-full rounded-xl border border-[#dcdfed] px-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={draftKpp}
                onChange={(e) => setDraftKpp(e.target.value)}
                placeholder="КПП точки"
                aria-label="КПП точки"
                className="h-10 w-full rounded-xl border border-[#dcdfed] px-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
              />
              <input
                type="tel"
                value={draftPhone}
                onChange={(e) => setDraftPhone(e.target.value)}
                placeholder="Телефон точки"
                aria-label="Телефон точки"
                className="h-10 w-full rounded-xl border border-[#dcdfed] px-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
              />
            </div>''', 1),
    ('''                  setDraftName(building.name);
                  setDraftAddress(building.address ?? "");
                }}''', '''                  setDraftName(building.name);
                  setDraftAddress(building.address ?? "");
                  setDraftKpp(building.kpp ?? "");
                  setDraftPhone(building.phone ?? "");
                }}''', 1),
    ('''            {building.address ? (
              <div className="mt-0.5 text-[13px] text-[#6f7282]">{building.address}</div>
            ) : (
              <div className="mt-0.5 text-[13px] text-[#9b9fb3]">Адрес не указан</div>
            )}
          </div>
        )}''', '''            {building.address ? (
              <div className="mt-0.5 text-[13px] text-[#6f7282]">{building.address}</div>
            ) : (
              <div className="mt-0.5 text-[13px] text-[#9b9fb3]">Адрес не указан</div>
            )}
            {building.kpp || building.phone ? (
              <div className="mt-0.5 text-[12px] text-[#9b9fb3]">
                {[building.kpp ? `КПП ${building.kpp}` : null, building.phone ? `тел. ${building.phone}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            ) : null}
          </div>
        )}''', 1),
    ('''      <div className="space-y-1.5">
        {building.rooms.length === 0 && !addingRoom ? (''', '''      {perLocationJournals ? (
        <div className="mb-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#0b1024]">
              <Users className="size-4 text-[#5566f6]" />
              Сотрудники точки
            </span>
            <span className="text-[#6f7282]">
              здесь: <b className="font-semibold text-[#0b1024] tabular-nums">{staffHere.length}</b>
              {staffEverywhere.length > 0 ? (
                <>
                  {" "}· везде: <b className="font-semibold text-[#0b1024] tabular-nums">{staffEverywhere.length}</b>
                </>
              ) : null}
            </span>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => {
                  setStaffDraft(new Set(staffHere.map((u) => u.id)));
                  setEditingStaff((v) => !v);
                }}
                className="ml-auto text-[13px] font-medium text-[#5566f6] hover:text-[#4a5bf0]"
              >
                {editingStaff ? "Скрыть" : "Изменить"}
              </button>
            ) : null}
          </div>
          {!editingStaff && staffHere.length > 0 ? (
            <div className="mt-1 truncate text-[12px] text-[#6f7282]">
              {staffHere.slice(0, 6).map((u) => u.name).join(", ")}
              {staffHere.length > 6 ? ` и ещё ${staffHere.length - 6}` : ""}
            </div>
          ) : null}
          {editingStaff ? (
            <div className="mt-2 space-y-2">
              <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
                {users.map((u) => {
                  const checked = staffDraft.has(u.id);
                  const everywhere = (userBuildingIds[u.id] ?? []).length === 0;
                  return (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] text-[#0b1024] hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(staffDraft);
                          if (e.target.checked) next.add(u.id);
                          else next.delete(u.id);
                          setStaffDraft(next);
                        }}
                        className="size-4 rounded border-[#dcdfed] accent-[#5566f6]"
                      />
                      <span className="min-w-0 flex-1 truncate">{u.name}</span>
                      {everywhere && !checked ? (
                        <span className="shrink-0 text-[11px] text-[#9b9fb3]">везде</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void saveStaff()}
                  disabled={savingStaff}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5566f6] px-3 text-[13px] font-medium text-white hover:bg-[#4a5bf0] disabled:opacity-60"
                >
                  <Check className="size-3.5" />
                  Сохранить
                </button>
                <span className="text-[11px] leading-snug text-[#6f7282]">
                  «Везде» — у сотрудника не выбрано ни одной точки. Снять единственную точку — он снова будет получать задачи со всех.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {building.rooms.length === 0 && !addingRoom ? (''', 1),
])
write(p, s)
print("round 3b done")
