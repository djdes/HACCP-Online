"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Gauge,
  Package,
  Smartphone,
  Sparkles,
  Thermometer,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Pricing calculator: bundle-first, customizable second.
 *
 * UX-цель: на лендинге блок «Подписка + оборудование» по высоте равен
 * соседним тарифам — не растягивает ряд. Маркетинг — сначала готовые
 * пакеты с указанием «что входит» и «для кого», самый популярный
 * подсвечен. «Подобрать вручную» раскрывает старый калькулятор для
 * fine-tuning, но 90% посетителей принимают решение по пакету.
 */

type DeviceOption = {
  id: string;
  title: string;
  icon: LucideIcon;
  price: number;
  /// "per-unit" lets the customer choose quantity; "flat" is a single
  /// checkbox (install / setup fee).
  mode: "per-unit" | "flat";
  hint?: string;
  defaultQty?: number;
};

const SUBSCRIPTION_MONTHLY = 1990;

const DEVICES: DeviceOption[] = [
  {
    id: "install",
    title: "Выездной монтаж и настройка",
    icon: Wrench,
    price: 9900,
    mode: "flat",
    hint: "Инженер приезжает на кухню, устанавливает датчики, настраивает профили и проводит обучение смены.",
    defaultQty: 1,
  },
  {
    id: "temp",
    title: "Датчик температуры",
    icon: Thermometer,
    price: 3490,
    mode: "per-unit",
    hint: "Для холодильной или морозильной камеры — одна штука на одно оборудование.",
    defaultQty: 2,
  },
  {
    id: "thermo",
    title: "Термогигрометр",
    icon: Gauge,
    price: 2890,
    mode: "per-unit",
    hint: "Для контроля температуры и влажности в зале / цеху.",
    defaultQty: 1,
  },
  {
    id: "tablet",
    title: "Планшет для кухни",
    icon: Smartphone,
    price: 12900,
    mode: "per-unit",
    hint: "10 дюймов, защитный чехол, предустановленный профиль. Клеится к стене в цехе.",
    defaultQty: 1,
  },
  {
    id: "nfc",
    title: "NFC-брелоки",
    icon: UserCheck,
    price: 490,
    mode: "per-unit",
    hint: "Вход в журналы одним тапом — по одному на активную смену.",
    defaultQty: 5,
  },
];

type BundleId = "solo" | "standard" | "network";
type BundlePreset = {
  id: BundleId;
  name: string;
  forWhom: string;
  /// маркетинговый «крючок» — что выдыхают на месте.
  hook: string;
  popular?: boolean;
  /// итоговое железо: device-id → qty.
  composition: Record<string, number>;
};

const BUNDLES: BundlePreset[] = [
  {
    id: "solo",
    name: "Соло",
    forWhom: "1 точка, маленькая смена",
    hook: "Один датчик в основной холодильник, термогигрометр в цехе, NFC-вход для смены.",
    composition: { install: 1, temp: 1, thermo: 1, tablet: 0, nfc: 3 },
  },
  {
    id: "standard",
    name: "Стандарт",
    forWhom: "Активная кухня, регулярные проверки",
    hook: "Все ключевые холодильники под датчиком, планшет на кухне, брелоки на всю смену.",
    popular: true,
    composition: { install: 1, temp: 2, thermo: 1, tablet: 1, nfc: 5 },
  },
  {
    id: "network",
    name: "Сетевой",
    forWhom: "Сеть из 2–3 точек или большое производство",
    hook: "Двойной выезд для разных адресов, расширенный набор датчиков и техники.",
    composition: { install: 2, temp: 5, thermo: 2, tablet: 2, nfc: 10 },
  },
];

function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function bundleTotal(bundle: BundlePreset): number {
  return DEVICES.reduce(
    (sum, d) => sum + d.price * (bundle.composition[d.id] ?? 0),
    0
  );
}

export function PricingCalculator() {
  // Default — Стандарт, как «most-popular anchor». Маркетинг: пользователь
  // приходит на лендинг, видит уже выбранный набор с реальной ценой —
  // не пугающий пустой калькулятор, а готовое предложение.
  const [selectedBundleId, setSelectedBundleId] = useState<BundleId | null>(
    "standard"
  );
  const [customExpanded, setCustomExpanded] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    BUNDLES.find((b) => b.id === "standard")!.composition
  );

  const setQty = (id: string, qty: number) => {
    setSelectedBundleId(null); // ручная правка → пакет «слетает»
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  };

  const applyBundle = (bundle: BundlePreset) => {
    setSelectedBundleId(bundle.id);
    setQuantities(bundle.composition);
  };

  const oneTime = useMemo(
    () =>
      DEVICES.reduce((sum, d) => sum + d.price * (quantities[d.id] ?? 0), 0),
    [quantities]
  );

  const activeDevices = DEVICES.filter((d) => (quantities[d.id] ?? 0) > 0)
    .length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7cf5c0]/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#116b2a]">
          <Package className="size-3.5" />
          С оборудованием
        </span>
        <span className="text-[13px] text-[#6f7282]">
          Подписка та же — выберите готовый набор
        </span>
      </div>

      {/* BUNDLES — компактные строки. Родительская карточка тарифа узкая
          (~340px на lg), 3 в ряд не помещаются красиво — вертикальный
          список читается лучше и сохраняет высоту, сравнимую с соседями. */}
      <div className="flex flex-col gap-2">
        {BUNDLES.map((bundle) => {
          const total = bundleTotal(bundle);
          const isActive = selectedBundleId === bundle.id;
          return (
            <button
              key={bundle.id}
              type="button"
              onClick={() => applyBundle(bundle)}
              aria-pressed={isActive}
              className={`group relative flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-[#5566f6] bg-white shadow-[0_6px_18px_-10px_rgba(85,102,246,0.35)]"
                  : "border-[#ececf4] bg-[#fafbff] hover:border-[#5566f6]/40 hover:bg-white"
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isActive
                    ? "border-[#5566f6] bg-[#5566f6] text-white"
                    : "border-[#dcdfed] bg-white text-transparent"
                }`}
                aria-hidden
              >
                <Check className="size-3" strokeWidth={3} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold tracking-[-0.005em] text-[#0b1024]">
                    {bundle.name}
                  </span>
                  {bundle.popular ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#0b1024] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white">
                      <Sparkles className="size-2.5" />
                      Популярный
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.45] text-[#6f7282]">
                  {bundle.hook}
                </p>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-[#9b9fb3]">
                  {bundle.forWhom}
                </span>
              </div>

              <span className="shrink-0 whitespace-nowrap text-[14px] font-semibold tabular-nums text-[#0b1024]">
                {formatRub(total)}
              </span>
            </button>
          );
        })}
      </div>

      {/* TOTALS — компактная плитка с подпиской и единоразовой суммой */}
      <div className="rounded-2xl bg-[#0b1024] p-5 text-white">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[12px] uppercase tracking-[0.14em] text-white/60">
            Подписка
          </div>
          <div className="text-right">
            <span className="text-[22px] font-semibold tracking-[-0.01em]">
              {formatRub(SUBSCRIPTION_MONTHLY)}
            </span>
            <span className="ml-1 text-[12px] text-white/60">/мес</span>
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <div className="text-[12px] uppercase tracking-[0.14em] text-white/60">
            {selectedBundleId
              ? `Пакет «${BUNDLES.find((b) => b.id === selectedBundleId)?.name}»`
              : "Единоразово"}
          </div>
          <div className="text-right">
            <span className="text-[22px] font-semibold tracking-[-0.01em]">
              {formatRub(oneTime)}
            </span>
            <span className="ml-1 text-[12px] text-white/60">
              {activeDevices > 0
                ? `· ${activeDevices} ${plural(activeDevices, "позиция", "позиции", "позиций")}`
                : "пусто"}
            </span>
          </div>
        </div>
      </div>

      <a
        href="https://t.me/wesetupbot"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
      >
        Оформить в Telegram
        <ArrowRight className="size-4" />
      </a>

      <button
        type="button"
        onClick={() => setCustomExpanded((v) => !v)}
        aria-expanded={customExpanded}
        aria-controls="custom-equipment-picker"
        className="-mt-1 inline-flex items-center justify-center gap-1.5 self-center rounded-full px-3 py-1 text-[12px] font-medium text-[#6f7282] transition-colors hover:text-[#0b1024]"
      >
        {customExpanded ? "Скрыть конфигуратор" : "Подобрать вручную"}
        <ChevronDown
          className={`size-3.5 transition-transform ${customExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* CUSTOM PICKER — collapsed по умолчанию. Открывается для тех,
          кому нужно поточечно настроить количество датчиков. */}
      {customExpanded ? (
        <div
          id="custom-equipment-picker"
          className="space-y-2.5 border-t border-[#ececf4] pt-5"
        >
          <p className="text-[12px] text-[#9b9fb3]">
            Выбираете каждую позицию вручную. Снимите галочку, если уже
            есть своё оборудование.
          </p>
          {DEVICES.map((d) => {
            const qty = quantities[d.id] ?? 0;
            const active = qty > 0;
            return (
              <div
                key={d.id}
                className={`group rounded-2xl border px-4 py-3 transition-colors ${
                  active
                    ? "border-[#5566f6]/40 bg-[#f5f6ff]"
                    : "border-[#ececf4] bg-[#fafbff]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setQty(
                        d.id,
                        active ? 0 : d.defaultQty ?? (d.mode === "flat" ? 1 : 1)
                      )
                    }
                    aria-pressed={active}
                    aria-label={`Переключить ${d.title}`}
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      active
                        ? "border-[#5566f6] bg-[#5566f6] text-white"
                        : "border-[#dcdfed] bg-white"
                    }`}
                  >
                    {active && <Check className="size-3" strokeWidth={3} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <d.icon className="size-4 shrink-0 text-[#5566f6]" />
                      <span className="min-w-0 text-[14px] font-medium text-[#0b1024]">
                        {d.title}
                      </span>
                      <span className="ml-auto whitespace-nowrap text-[13px] font-semibold text-[#0b1024]">
                        {formatRub(d.price)}
                        {d.mode === "per-unit" && (
                          <span className="text-[11px] font-normal text-[#9b9fb3]">
                            {" "}
                            × шт
                          </span>
                        )}
                      </span>
                    </div>
                    {d.hint && (
                      <p className="mt-1 text-[12px] leading-[1.5] text-[#6f7282]">
                        {d.hint}
                      </p>
                    )}
                    {active && d.mode === "per-unit" && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#dcdfed] bg-white p-1">
                        <button
                          type="button"
                          aria-label="Убрать одну штуку"
                          onClick={() => setQty(d.id, qty - 1)}
                          className="flex size-7 items-center justify-center rounded-lg text-[#6f7282] transition-colors hover:bg-[#f5f6ff] hover:text-[#0b1024]"
                        >
                          −
                        </button>
                        <span className="min-w-[24px] text-center text-[14px] font-semibold tabular-nums text-[#0b1024]">
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label="Добавить одну штуку"
                          onClick={() => setQty(d.id, qty + 1)}
                          className="flex size-7 items-center justify-center rounded-lg text-[#6f7282] transition-colors hover:bg-[#f5f6ff] hover:text-[#0b1024]"
                        >
                          +
                        </button>
                        <span className="pr-2 text-[11px] text-[#9b9fb3]">
                          = {formatRub(d.price * qty)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="-mt-1 text-center text-[12px] text-[#9b9fb3]">
        Привозим и ставим в течение 3 рабочих дней по Москве и области.
      </p>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
