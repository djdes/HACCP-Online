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


# ---------- schema: last active building ----------
patch("prisma/schema.prisma", [
    ('''  lastActiveOrganizationId    String?
  organizationMemberships     OrganizationMember[]     @relation("OrganizationMemberships")''',
     '''  lastActiveOrganizationId    String?
  /// Точки (2026-09-05): последняя выбранная точка. Подставляется, когда
  /// cookie нет — на новом устройстве человек попадает в ту же точку.
  lastActiveBuildingId        String?
  organizationMemberships     OrganizationMember[]     @relation("OrganizationMemberships")''', 1),
])

# ---------- active-building: fallback to the remembered building ----------
patch("src/lib/active-building.ts", [
    ('''        select: { organizationId: true, buildingIds: true },
      }),
      cookies(),
    ]);''', '''        select: { organizationId: true, buildingIds: true, lastActiveBuildingId: true },
      }),
      cookies(),
    ]);''', 1),
    ('''    const userBuildingIds =
      user && user.organizationId === organizationId ? user.buildingIds : [];
    return resolveActiveBuilding({
      enabled: organization?.perLocationJournals === true,
      buildings,
      userBuildingIds,
      cookieBuildingId: decodeBuildingCookie(
        cookieStore.get(ACTIVE_BUILDING_COOKIE)?.value,
        organizationId,
      ),
    });''', '''    const homeOrg = Boolean(user && user.organizationId === organizationId);
    const userBuildingIds = homeOrg && user ? user.buildingIds : [];
    // Cookie — быстрый выбор на этом устройстве; без неё берём точку,
    // запомненную в аккаунте (новый телефон открывает ту же точку).
    const cookieBuildingId = decodeBuildingCookie(
      cookieStore.get(ACTIVE_BUILDING_COOKIE)?.value,
      organizationId,
    );
    return resolveActiveBuilding({
      enabled: organization?.perLocationJournals === true,
      buildings,
      userBuildingIds,
      cookieBuildingId:
        cookieBuildingId ?? (homeOrg && user ? user.lastActiveBuildingId : null),
    });''', 1),
])
patch("src/app/api/me/active-building/route.ts", [
    ('''  const organizationId = getActiveOrgId(session);
  await setActiveBuildingCookie(organizationId, building.id);
''', '''  const organizationId = getActiveOrgId(session);
  await setActiveBuildingCookie(organizationId, building.id);
  // В аккаунт — чтобы на другом устройстве открылась та же точка.
  await db.user
    .update({ where: { id: session.user.id }, data: { lastActiveBuildingId: building.id } })
    .catch(() => {});
''', 1),
])

# ---------- header: mobile pill, manage link, section label ----------
patch("src/components/layout/header.tsx", [
    ('''        {partnerHint ? <PartnerHint rates={partnerHint} className="-ml-1" /> : null}
''', '''        {partnerHint ? <PartnerHint rates={partnerHint} className="-ml-1" /> : null}
        {/* Точки на телефоне: пилюля сразу после логотипа — иначе точку
            видно только внутри меню-шторки. */}
        {buildings.length >= 2 ? (
          <LocationSwitcherPill
            buildings={buildings}
            activeBuildingId={activeBuildingId}
            compact
            manageHref={fullAccess ? "/settings/buildings" : null}
            className="md:hidden"
          />
        ) : null}
''', 1),
    ('''            <LocationSwitcherPill
              buildings={buildings}
              activeBuildingId={activeBuildingId}
            />
          ) : null}

          {/* «Сотрудники» — вытащено из дропдауна в постоянную pill-кнопку''', '''            <LocationSwitcherPill
              buildings={buildings}
              activeBuildingId={activeBuildingId}
              manageHref={fullAccess ? "/settings/buildings" : null}
            />
          ) : null}

          {/* «Сотрудники» — вытащено из дропдауна в постоянную pill-кнопку''', 1),
    ('''              {buildings.length >= 2 ? (
                <LocationSwitcherList
                  buildings={buildings}
                  activeBuildingId={activeBuildingId}
                />
              ) : null}
              {navItems.map((item) => {''', '''              {buildings.length >= 2 ? (
                <>
                  <LocationSwitcherList
                    buildings={buildings}
                    activeBuildingId={activeBuildingId}
                  />
                  <div className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9b9fb3]">
                    Разделы
                  </div>
                </>
              ) : null}
              {navItems.map((item) => {''', 1),
])

# ---------- staff: default building for new employees + banner ----------
patch("src/components/staff/staff-types.ts", [
    ('''  /** Журналы ведутся отдельно по точкам — чипы показываются только тогда. */
  perLocationJournals?: boolean;''', '''  /** Журналы ведутся отдельно по точкам — чипы показываются только тогда. */
  perLocationJournals?: boolean;
  /** Активная точка — новый сотрудник по умолчанию привязывается к ней. */
  activeBuildingId?: string | null;''', 1),
])
patch("src/app/(dashboard)/settings/users/page.tsx", [
    ('import { listOrganizationBuildings } from "@/lib/active-building";',
     'import { getActiveBuildingId, listOrganizationBuildings } from "@/lib/active-building";', 1),
    ('''  const staffBuildings = await listOrganizationBuildings(orgId);
''', '''  const staffBuildings = await listOrganizationBuildings(orgId);
  const activeBuildingId = await getActiveBuildingId(session);
''', 1),
    ('''      buildings={staffBuildings}
      perLocationJournals={organization?.perLocationJournals === true}
''', '''      buildings={staffBuildings}
      perLocationJournals={organization?.perLocationJournals === true}
      activeBuildingId={activeBuildingId}
''', 1),
])
s = read("src/components/staff/staff-page-client.tsx")
if "MapPin" not in s.split('from "lucide-react"')[0]:
    s = s.replace("import {\n  ", "import {\n  MapPin,\n  ", 1)
s = apply("src/components/staff/staff-page-client.tsx", s, [
    ('''  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сотрудники"''', '''  }).length;
  // Точки: сотрудники без точки получают задачи со всех точек — об этом
  // стоит сказать сразу, а не ждать вопросов «почему мне пришло втрое».
  const staffWithoutBuilding = props.perLocationJournals
    ? props.employees.filter(
        (e) => e.isActive && !e.isRoot && (e.buildingIds ?? []).length === 0
      ).length
    : 0;
  const staffWord = (n: number) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return "сотрудник";
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "сотрудника";
    return "сотрудников";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сотрудники"''', 1),
    ('''      />

      {/* Bulk-action toolbar. */}''', '''      />

      {staffWithoutBuilding > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[#ffe1b5] bg-[#fff8ec] px-4 py-2.5 text-[13px] leading-snug text-[#8a5a12]">
          <MapPin className="size-4 shrink-0" />
          <span>
            <b className="font-semibold">{staffWithoutBuilding}</b> {staffWord(staffWithoutBuilding)} без
            точки — задачи по журналам приходят им со всех точек. Точки ставятся
            чипами в карточке сотрудника.
          </span>
        </div>
      ) : null}

      {/* Bulk-action toolbar. */}''', 1),
    ('''          buildings={props.buildings ?? []}
          perLocationJournals={props.perLocationJournals === true}
          open
          onClose={() => setDlg(null)}
          // Должность создана — список обновляем, но диалог остаётся''', '''          buildings={props.buildings ?? []}
          perLocationJournals={props.perLocationJournals === true}
          defaultBuildingIds={
            props.perLocationJournals && props.activeBuildingId
              ? [props.activeBuildingId]
              : []
          }
          open
          onClose={() => setDlg(null)}
          // Должность создана — список обновляем, но диалог остаётся''', 1),
])
write("src/components/staff/staff-page-client.tsx", s)
patch("src/components/staff/staff-dialogs.tsx", [
    ('''  buildings?: BuildingOption[];
  perLocationJournals?: boolean;
  /** Должность создана: обновить список, но диалог оставить открытым. */''', '''  buildings?: BuildingOption[];
  perLocationJournals?: boolean;
  /** Точки нового сотрудника по умолчанию — активная точка менеджера. */
  defaultBuildingIds?: string[];
  /** Должность создана: обновить список, но диалог оставить открытым. */''', 1),
    ('''  const [buildingIds, setBuildingIds] = useState<string[]>([]);
  const [weeklyDaysOff, setWeeklyDaysOff] = useState<number[]>([''', '''  const [buildingIds, setBuildingIds] = useState<string[]>(
    () => props.defaultBuildingIds ?? []
  );
  const [weeklyDaysOff, setWeeklyDaysOff] = useState<number[]>([''', 1),
])

# ---------- buildings page: read-only for view partners, unnamed callout ----------
patch("src/app/(dashboard)/settings/buildings/page.tsx", [
    ('''      <BuildingsClient
        initial={buildings}
        users={users}
        perLocationJournals={organization?.perLocationJournals === true}
      />''', '''      <BuildingsClient
        initial={buildings}
        users={users}
        perLocationJournals={organization?.perLocationJournals === true}
        // Консультант уровня «просмотр» видит точки, но не меняет их:
        // отказ по клику выглядел бы как поломка.
        readOnly={session.user.partnerAccess?.level === "view"}
        unnamedCount={buildings.filter((b) => /^Точка \\d+$/.test(b.name)).length}
      />''', 1),
])

s = read("src/app/(dashboard)/settings/buildings/buildings-client.tsx")
s = apply("src/app/(dashboard)/settings/buildings/buildings-client.tsx", s, [
    ('import { Building2, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";',
     'import { Building2, Check, Copy, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";', 1),
    ('''  perLocationJournals = false,
}: {
  initial: Building[];
  users: RoomResponsibleUser[];
  /** Точки (2026-09-05): документы журналов ведутся отдельно по зданиям. */
  perLocationJournals?: boolean;
}) {''', '''  perLocationJournals = false,
  readOnly = false,
  unnamedCount = 0,
}: {
  initial: Building[];
  users: RoomResponsibleUser[];
  /** Точки (2026-09-05): документы журналов ведутся отдельно по зданиям. */
  perLocationJournals?: boolean;
  /** Консультант уровня «просмотр»: всё видно, ничего не меняется. */
  readOnly?: boolean;
  /** Сколько точек ещё называются «Точка N» — подсказать переименовать. */
  unnamedCount?: number;
}) {''', 1),
    ('''  async function togglePerLocation(next: boolean) {
    setFlagPending(true);''', '''  async function togglePerLocation(next: boolean) {
    if (!next) {
      const ok = await confirmAsync({
        title: "Выключить раздельные журналы?",
        description:
          "Документы всех точек будут показываться вместе, а ночное автосоздание вернётся к одному общему документу на журнал. Уже созданные документы точек останутся.",
        variant: "warn",
        confirmLabel: "Выключить",
      });
      if (!ok) return;
    }
    setFlagPending(true);''', 1),
    ('''          <Switch
            checked={perLocationJournals}
            disabled={flagPending}
            onCheckedChange={(next) => void togglePerLocation(next)}
            aria-label="Вести журналы отдельно по точкам"
          />
        </div>
      ) : null}
''', '''          <Switch
            checked={perLocationJournals}
            disabled={flagPending || readOnly}
            title={readOnly ? "Изменяет клиент — у консультанта только просмотр" : undefined}
            onCheckedChange={(next) => void togglePerLocation(next)}
            aria-label="Вести журналы отдельно по точкам"
          />
        </div>
      ) : null}

      {perLocationJournals && unnamedCount > 0 && !readOnly ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#ffe1b5] bg-[#fff8ec] px-4 py-3 text-[13px] leading-snug text-[#8a5a12]">
          <Pencil className="mt-0.5 size-4 shrink-0" />
          <span>
            {unnamedCount === 1 ? "Одна точка ещё называется" : `${unnamedCount} точки ещё называются`}{" "}
            «Точка N». Название и адрес печатаются в шапке журналов и PDF —
            нажмите карандаш у точки и впишите настоящие.
          </span>
        </div>
      ) : null}
''', 1),
    ('''        <BuildingCard
          key={b.id}
          building={b}
          userNameById={userNameById}
          onRefresh={refresh}
          onDelete={() => deleteBuilding(b.id, b.name)}
          onEditRoom={openEditor}
        />''', '''        <BuildingCard
          key={b.id}
          building={b}
          userNameById={userNameById}
          readOnly={readOnly}
          donors={initial
            .filter((x) => x.id !== b.id && x.rooms.length > 0)
            .map((x) => ({ id: x.id, name: x.name, roomsCount: x.rooms.length }))}
          onRefresh={refresh}
          onDelete={() => deleteBuilding(b.id, b.name)}
          onEditRoom={openEditor}
        />''', 1),
    ('''      {adding ? (
        <div className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-[#0b1024]">Новая точка</div>''', '''      {readOnly ? null : adding ? (
        <div className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-[#0b1024]">Новая точка</div>''', 1),
    # BuildingCard: props
    ('''function BuildingCard({
  building,
  userNameById,
  onRefresh,
  onDelete,
  onEditRoom,
}: {
  building: Building;
  userNameById: Map<string, string>;
  onRefresh: () => void;
  onDelete: () => void;
  onEditRoom: (room: Room) => void;
}) {
  const [addingRoom, setAddingRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomKind, setRoomKind] = useState<string>("other");
''', '''function BuildingCard({
  building,
  userNameById,
  readOnly = false,
  donors,
  onRefresh,
  onDelete,
  onEditRoom,
}: {
  building: Building;
  userNameById: Map<string, string>;
  readOnly?: boolean;
  /** Другие точки с помещениями — откуда можно скопировать справочник. */
  donors: Array<{ id: string; name: string; roomsCount: number }>;
  onRefresh: () => void;
  onDelete: () => void;
  onEditRoom: (room: Room) => void;
}) {
  const [addingRoom, setAddingRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomKind, setRoomKind] = useState<string>("other");
  // Название и адрес точки правятся на месте: они печатаются в шапке
  // журналов и PDF, и «Точка 1» из анкеты должна стать настоящим адресом.
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(building.name);
  const [draftAddress, setDraftAddress] = useState(building.address ?? "");
  const [savingHead, setSavingHead] = useState(false);
  const [donorId, setDonorId] = useState<string>(donors[0]?.id ?? "");
  const [copying, setCopying] = useState(false);

  async function saveHead() {
    const name = draftName.trim();
    if (!name) {
      toast.error("Введите название точки");
      return;
    }
    setSavingHead(true);
    try {
      const res = await fetch(`/api/settings/buildings/${building.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: draftAddress.trim() || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Не удалось сохранить");
      toast.success("Точка обновлена");
      setEditing(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSavingHead(false);
    }
  }

  async function copyRooms() {
    if (!donorId) return;
    setCopying(true);
    try {
      const res = await fetch(`/api/settings/buildings/${building.id}/copy-rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromBuildingId: donorId }),
      });
      const d = (await res.json().catch(() => ({}))) as { copied?: number; error?: string };
      if (!res.ok) throw new Error(d?.error ?? "Не удалось скопировать");
      toast.success(`Скопировано помещений: ${d.copied ?? 0}`);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setCopying(false);
    }
  }
''', 1),
    # BuildingCard: header with inline edit + hidden delete for read-only
    ('''        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-[#5566f6]" />
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              {building.name}
            </h2>
          </div>
          {building.address ? (
            <div className="mt-0.5 text-[13px] text-[#6f7282]">{building.address}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Удалить точку"
          className="rounded-full p-1.5 text-[#9b9fb3] hover:bg-[#fff4f2] hover:text-[#d2453d]"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
''', '''        {editing ? (
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              aria-label="Название точки"
              autoFocus
              className="h-10 w-full rounded-xl border border-[#dcdfed] px-3 text-[15px] font-semibold text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />
            <input
              type="text"
              value={draftAddress}
              onChange={(e) => setDraftAddress(e.target.value)}
              placeholder="Адрес — печатается в шапке журналов"
              aria-label="Адрес точки"
              className="h-10 w-full rounded-xl border border-[#dcdfed] px-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveHead()}
                disabled={savingHead}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5566f6] px-3 text-[13px] font-medium text-white hover:bg-[#4a5bf0] disabled:opacity-60"
              >
                <Check className="size-3.5" />
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraftName(building.name);
                  setDraftAddress(building.address ?? "");
                }}
                className="inline-flex h-9 items-center rounded-xl px-3 text-[13px] text-[#6f7282] hover:bg-[#f5f6ff] hover:text-[#0b1024]"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-[#5566f6]" />
              <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
                {building.name}
              </h2>
            </div>
            {building.address ? (
              <div className="mt-0.5 text-[13px] text-[#6f7282]">{building.address}</div>
            ) : (
              <div className="mt-0.5 text-[13px] text-[#9b9fb3]">Адрес не указан</div>
            )}
          </div>
        )}
        {!readOnly && !editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Переименовать точку и адрес"
              title="Название и адрес"
              className="rounded-full p-1.5 text-[#9b9fb3] hover:bg-[#f5f6ff] hover:text-[#5566f6]"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Удалить точку"
              className="rounded-full p-1.5 text-[#9b9fb3] hover:bg-[#fff4f2] hover:text-[#d2453d]"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
''', 1),
    # BuildingCard: empty state with copy-from
    ('''        {building.rooms.length === 0 && !addingRoom ? (
          <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-3 text-center text-[13px] text-[#6f7282]">
            Помещений пока нет — добавьте, чтобы они появились в журналах
            уборки.
          </div>
        ) : null}''', '''        {building.rooms.length === 0 && !addingRoom ? (
          <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-3 text-center text-[13px] text-[#6f7282]">
            Помещений пока нет — добавьте, чтобы они появились в журналах
            уборки.
            {!readOnly && donors.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="text-[#3c4053]">или скопируйте из</span>
                <select
                  value={donorId}
                  onChange={(e) => setDonorId(e.target.value)}
                  aria-label="Точка, откуда скопировать помещения"
                  className="h-9 rounded-xl border border-[#dcdfed] bg-white px-2.5 text-[13px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none"
                >
                  {donors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.roomsCount}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void copyRooms()}
                  disabled={copying}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] font-medium text-[#0b1024] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-60"
                >
                  <Copy className="size-3.5 text-[#5566f6]" />
                  {copying ? "Копируем…" : "Скопировать"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}''', 1),
])
write("src/app/(dashboard)/settings/buildings/buildings-client.tsx", s)

# ---------- auto-journals: how many locations get documents ----------
patch("src/app/(dashboard)/settings/auto-journals/page.tsx", [
    ('import { Sparkles } from "lucide-react";', 'import { MapPin, Sparkles } from "lucide-react";', 1),
    ('import { getActiveBuildingId } from "@/lib/active-building";',
     'import { buildingTargets, getActiveBuildingId } from "@/lib/active-building";', 1),
    ('''  return (
    <div className="space-y-5">
      <div>

        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Sparkles className="size-5" />
          </span>''', '''  // Точки: документы создаются на каждую точку — скажем об этом прямо
  // над списком, чтобы «35 журналов» не превратились неожиданно в 105.
  const locationsCount = (await buildingTargets(organizationId)).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div>

        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Sparkles className="size-5" />
          </span>''', 1),
    ('''      <PageGuide
        title="Как настроить авто-создание"''', '''      {locationsCount >= 2 ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#dfe3ff] bg-[#f5f6ff] px-4 py-2.5 text-[13px] text-[#3848c7]">
          <MapPin className="size-4 shrink-0" />
          <span>
            Точек: <b className="font-semibold tabular-nums">{locationsCount}</b> — каждый
            отмеченный журнал создаётся на каждую точку отдельно.
          </span>
        </div>
      ) : null}

      <PageGuide
        title="Как настроить авто-создание"''', 1),
])

# ---------- search: location in the document hint ----------
patch("src/app/api/search/route.ts", [
    ('''        status: true,
        template: { select: { code: true, name: true } },
      },
      take: LIMIT_PER_KIND,
      orderBy: { createdAt: "desc" },''', '''        status: true,
        template: { select: { code: true, name: true } },
        building: { select: { name: true } },
      },
      take: LIMIT_PER_KIND,
      orderBy: { createdAt: "desc" },''', 1),
    ('''      hint: `${d.template.name} · ${d.status === "closed" ? "Закрыт" : "Активный"}`,''',
     '''      hint: [d.template.name, d.building?.name, d.status === "closed" ? "Закрыт" : "Активный"]
        .filter(Boolean)
        .join(" · "),''', 1),
])

# ---------- crumb menu: shared documents are marked ----------
patch("src/lib/journal-crumb-menu.ts", [
    ('''      hint: doc.building
        ? `${doc.building.name} · ${formatPeriodStart(doc.dateFrom)}`
        : formatPeriodStart(doc.dateFrom),''', '''      hint: doc.building
        ? `${doc.building.name} · ${formatPeriodStart(doc.dateFrom)}`
        : buildingId
          ? `Общий · ${formatPeriodStart(doc.dateFrom)}`
          : formatPeriodStart(doc.dateFrom),''', 1),
])

# ---------- Mini App: location in the top bar ----------
patch("src/app/mini/layout.tsx", [
    ('import { getServerSession } from "@/lib/server-session";',
     'import { getServerSession } from "@/lib/server-session";\nimport { loadBuildingContext } from "@/lib/active-building";', 1),
    ('            <MiniTopBar partnerHint={partnerHint} />',
     '            <MiniTopBar partnerHint={partnerHint} locationName={locationName} />', 1),
])
s = read("src/app/mini/layout.tsx")
anchor = "  // Та же иконка партнёрской программы, что на сайте (П-3). Mini App"
assert s.count(anchor) == 1
s = s.replace(anchor, '''  // Точки: название активной точки в верхней панели на всех экранах
  // Mini App — зеркало пилюли в шапке сайта (П-3).
  const buildingContext = session?.user?.id
    ? await loadBuildingContext(session).catch(() => null)
    : null;
  const locationName = buildingContext?.enabled
    ? buildingContext.activeBuilding?.name ?? null
    : null;

''' + anchor)
write("src/app/mini/layout.tsx", s)
s = read("src/app/mini/_components/mini-shell.tsx")
if "MapPin" not in s.split('from "lucide-react"')[0]:
    s = re.sub(r'import \{([^}]*)\} from "lucide-react";', lambda m: 'import {' + m.group(1).rstrip() + (', MapPin' if not m.group(1).rstrip().endswith(',') else ' MapPin,') + ' } from "lucide-react";', s, count=1)
s = apply("src/app/mini/_components/mini-shell.tsx", s, [
    ('''export function MiniTopBar({
  partnerHint = null,
}: {
  /** Ставки для иконки «партнёрская программа» у логотипа; null — скрыть. */
  partnerHint?: PartnerHintRates | null;
} = {}) {''', '''export function MiniTopBar({
  partnerHint = null,
  locationName = null,
}: {
  /** Ставки для иконки «партнёрская программа» у логотипа; null — скрыть. */
  partnerHint?: PartnerHintRates | null;
  /** Активная точка (режим точек включён); null — не показывать. */
  locationName?: string | null;
} = {}) {''', 1),
    ('''            <div
              className="mini-display-bold truncate"
              style={{ fontSize: 16, marginTop: 2 }}
            >
              {title}
            </div>
          </div>
        </Link>''', '''            <div
              className="mini-display-bold truncate"
              style={{ fontSize: 16, marginTop: 2 }}
            >
              {title}
            </div>
            {locationName ? (
              <div
                className="flex items-center gap-1 truncate text-[12px]"
                style={{ color: "var(--mini-text-muted)", marginTop: 1 }}
              >
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{locationName}</span>
              </div>
            ) : null}
          </div>
        </Link>''', 1),
])
write("src/app/mini/_components/mini-shell.tsx", s)

# ---------- whats-new ----------
patch("src/lib/whats-new-notes.ts", [
    ('''      "Точка печатается в шапке документа и в PDF рядом с названием организации, а задачи в TasksFlow и сводки в Telegram подписаны названием точки.",
    ],
  },''', '''      "Точка печатается в шапке документа и в PDF рядом с названием организации, а задачи в TasksFlow и сводки в Telegram подписаны названием точки.",
      "Точка видна в шапке на телефоне и в верхней панели Mini App; в меню точек — ссылка «Настроить точки»; выбранная точка запоминается в аккаунте, а не только в браузере.",
      "На странице «Точки и помещения» название и адрес точки правятся карандашом, помещения можно скопировать из другой точки, а выключение раздельных журналов спрашивает подтверждение.",
      "Новый сотрудник по умолчанию привязывается к активной точке; на странице сотрудников видно, сколько человек без точки получают задачи со всех точек.",
    ],
  },''', 1),
])
print("round 2 done")
