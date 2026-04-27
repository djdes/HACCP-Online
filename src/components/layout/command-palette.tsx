"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

/**
 * J5 — ⌘K / Ctrl+K command palette. Открывается из любого места
 * dashboard, ищет по списку основных разделов и переходит по
 * выбранному. Без внешних libs (cmdk не подключён).
 *
 * Список ROUTES — статика, можно расширять. Server-side данных
 * не подгружаем (журналы / сотрудники) чтобы не делать палитру
 * тяжёлой.
 */
type Route = {
  label: string;
  href: string;
  hint?: string;
  keywords?: string[];
};

const ROUTES: Route[] = [
  { label: "Главная", href: "/dashboard", keywords: ["dashboard", "главная"] },
  { label: "Журналы", href: "/journals", keywords: ["journals", "журналы"] },
  { label: "Отчёты", href: "/reports", keywords: ["reports", "compliance", "heatmap"] },
  { label: "CAPA", href: "/capa", keywords: ["capa", "корректирующее"] },
  { label: "Партии", href: "/batches", keywords: ["batches", "партии"] },
  { label: "Потери", href: "/losses", keywords: ["losses", "потери"] },
  { label: "Планы", href: "/plans", keywords: ["plans"] },
  { label: "Изменения", href: "/changes", keywords: ["changes"] },
  { label: "Компетенции", href: "/competencies", keywords: ["staff competency", "медкнижка"] },
  { label: "Настройки — Сотрудники", href: "/settings/users", keywords: ["staff", "users"] },
  { label: "Настройки — Журналы", href: "/settings/journals", keywords: ["templates"] },
  { label: "Настройки — Оборудование", href: "/settings/equipment", keywords: ["equipment", "холодильник"] },
  { label: "Настройки — Подписка", href: "/settings/subscription", keywords: ["billing", "тариф"] },
  { label: "Настройки — Compliance", href: "/settings/compliance", keywords: ["closed day", "закрытый день"] },
  { label: "Настройки — Бухгалтерия (1С)", href: "/settings/accounting", keywords: ["accounting", "1с", "потери"] },
  { label: "Настройки — Бэкап Я.Диск", href: "/settings/backup", keywords: ["yandex", "backup"] },
  { label: "Настройки — Аудит", href: "/settings/audit", keywords: ["audit", "журнал действий"] },
  { label: "Настройки — TasksFlow", href: "/settings/integrations/tasksflow", keywords: ["tasksflow", "tf"] },
  { label: "Настройки — Портал инспектора", href: "/settings/inspector-portal", keywords: ["inspector", "сэс", "роспотребнадзор"] },
  { label: "Справочник СанПиН", href: "/sanpin", keywords: ["санпин", "нормы"] },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Focus после mount.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ROUTES.slice(0, 10);
    return ROUTES.filter((r) => {
      if (r.label.toLowerCase().includes(q)) return true;
      if (r.href.toLowerCase().includes(q)) return true;
      if (r.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    }).slice(0, 12);
  }, [query]);

  function pick(idx: number) {
    const r = filtered[idx];
    if (!r) return;
    setOpen(false);
    router.push(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(activeIdx);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#ececf4] bg-white shadow-[0_30px_80px_-20px_rgba(11,16,36,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[#ececf4] px-4 py-3">
          <Search className="size-4 text-[#9b9fb3]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Куда перейти? (журналы, отчёты, настройки...)"
            className="flex-1 bg-transparent text-[15px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:outline-none"
          />
          <kbd className="rounded-md border border-[#ececf4] bg-[#fafbff] px-1.5 py-0.5 text-[11px] text-[#6f7282]">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="rounded-xl px-3 py-3 text-center text-[13px] text-[#9b9fb3]">
              Ничего не нашлось
            </li>
          ) : (
            filtered.map((r, i) => (
              <li
                key={r.href}
                onClick={() => pick(i)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 ${
                  i === activeIdx ? "bg-[#f5f6ff] text-[#3848c7]" : "text-[#0b1024]"
                }`}
              >
                <span className="text-[14px]">{r.label}</span>
                <ArrowRight className="size-4 text-[#9b9fb3]" />
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between border-t border-[#ececf4] bg-[#fafbff] px-4 py-2 text-[11px] text-[#9b9fb3]">
          <span>↑↓ навигация · Enter выбрать</span>
          <span>⌘K / Ctrl+K — открыть/закрыть</span>
        </div>
      </div>
    </div>
  );
}
