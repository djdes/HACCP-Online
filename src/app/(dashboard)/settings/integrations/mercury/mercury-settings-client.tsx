"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Enterprise = {
  id: string;
  enterpriseGuid: string;
  activityLocationGuid: string | null;
  name: string;
  address: string | null;
  enabled: boolean;
  buildingId: string | null;
};

type Integration = {
  environment: string;
  issuerGuid: string;
  initiatorLogin: string;
  enabled: boolean;
  autoProcessMode: string;
  autoSupplierInns: string[];
  notifyUserId: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  label: string | null;
  enterprises: Enterprise[];
  documentsCount: number;
  queueCount: number;
};

const MODES: Array<{ value: string; title: string; body: string }> = [
  {
    value: "off",
    title: "Только читать",
    body: "Входящие ВСД видны и заполняют журнал приёмки, но гасите вы сами в кабинете Меркурия.",
  },
  {
    value: "assisted",
    title: "Гашу сам, одной кнопкой — рекомендуем",
    body: "Система находит документ, считает срок, напоминает и заполняет строку журнала. Гашение — по вашей кнопке после физической приёмки.",
  },
  {
    value: "auto_after_journal",
    title: "Автоматически после заполнения журнала",
    body: "Гасит само, но ТОЛЬКО после того, как человек заполнил строку входного контроля и поставил «принять», и только при полном совпадении объёма. Работает по белому списку поставщиков.",
  },
];

export function MercurySettingsClient({
  available,
  mode,
  orgName,
  orgInn,
  integration,
  buildings,
  users,
}: {
  available: boolean;
  mode: "mock" | "live";
  orgName: string;
  orgInn: string | null;
  integration: Integration | null;
  buildings: Array<{ id: string; name: string; address: string | null }>;
  users: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [issuerGuid, setIssuerGuid] = useState(integration?.issuerGuid ?? "");
  const [initiatorLogin, setInitiatorLogin] = useState(
    integration?.initiatorLogin ?? "",
  );
  const [environment, setEnvironment] = useState(integration?.environment ?? "test");
  const [autoMode, setAutoMode] = useState(integration?.autoProcessMode ?? "assisted");

  async function connect() {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/mercury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuerGuid, initiatorLogin, environment }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Не удалось сохранить");
      toast.success("Реквизиты сохранены");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function patch(payload: Record<string, unknown>, okText: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/mercury", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Не удалось сохранить");
      toast.success(okText);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (!available) {
    return (
      <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
        <div className="text-[15px] font-medium text-[#0b1024]">
          Меркурий доступен на тарифе «Про»
        </div>
        <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] leading-[1.6] text-[#6f7282]">
          Входящие ВСД, гашение в один тап и автозаполнение журнала приёмки.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Демо-режим обязан быть заметен: принять выдуманные ВСД за
          настоящие — худшее, что может случиться с этой интеграцией. */}
      {mode === "mock" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#f0c674] bg-[#fff8e6] p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#a1740a]" />
          <div className="text-[13px] leading-[1.6] text-[#7a5a08]">
            <div className="font-semibold">Демо-режим — данные не из Меркурия</div>
            Ключ доступа к Ветис.API ещё не настроен на сервере, поэтому
            показываются учебные документы. Настоящие ВСД появятся после
            одобрения заявки Россельхознадзором.
          </div>
        </div>
      ) : null}

      {/* Статус информационной системы */}
      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
          Подключение
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          {mode === "live" ? (
            <>
              <ShieldCheck className="size-4 text-[#116b2a]" />
              <span className="text-[#116b2a]">
                Информационная система WeSetup зарегистрирована в Ветис.API
              </span>
            </>
          ) : (
            <span className="text-[#6f7282]">
              Ключ Ветис.API не настроен на сервере — работает демо-режим
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="issuerGuid" className="text-[13px]">
              ГУИД хозяйствующего субъекта
            </Label>
            <Input
              id="issuerGuid"
              value={issuerGuid}
              onChange={(e) => setIssuerGuid(e.target.value)}
              placeholder="из кабинета Меркурия"
              className="mt-1.5 h-11 rounded-2xl border-[#dcdfed] px-3.5 text-[14px]"
            />
            <p className="mt-1 text-[12px] text-[#9b9fb3]">
              {orgName}
              {orgInn ? ` · ИНН ${orgInn}` : ""}
            </p>
          </div>
          <div>
            <Label htmlFor="initiatorLogin" className="text-[13px]">
              Логин уполномоченного лица
            </Label>
            <Input
              id="initiatorLogin"
              value={initiatorLogin}
              onChange={(e) => setInitiatorLogin(e.target.value)}
              placeholder="от чьего имени гасятся ВСД"
              className="mt-1.5 h-11 rounded-2xl border-[#dcdfed] px-3.5 text-[14px]"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="h-11 rounded-2xl border border-[#dcdfed] bg-white px-3.5 text-[14px]"
          >
            <option value="test">Тестовый контур</option>
            <option value="prod">Продуктивный контур</option>
          </select>
          <Button
            onClick={connect}
            disabled={saving || !issuerGuid || !initiatorLogin}
            className="h-11 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0]"
          >
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Сохранить реквизиты
          </Button>
        </div>
      </section>

      {/* Режим гашения */}
      {integration ? (
        <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Режим гашения
          </div>
          <p className="mb-4 text-[13px] leading-[1.6] text-[#6f7282]">
            Гашение ВСД — юридически значимое действие уполномоченного лица.
            Мы намеренно не делаем его за вас по умолчанию.
          </p>
          <div className="space-y-2.5">
            {MODES.map((item) => (
              <label
                key={item.value}
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors duration-150 ${
                  autoMode === item.value
                    ? "border-[#5566f6]/40 bg-[#f5f6ff]"
                    : "border-[#ececf4] hover:bg-[#fafbff]"
                }`}
              >
                <input
                  type="radio"
                  name="autoProcessMode"
                  value={item.value}
                  checked={autoMode === item.value}
                  onChange={() => {
                    setAutoMode(item.value);
                    void patch(
                      { autoProcessMode: item.value },
                      "Режим гашения изменён",
                    );
                  }}
                  className="mt-1 size-4 accent-[#5566f6]"
                />
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-[#0b1024]">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-[1.55] text-[#6f7282]">
                    {item.body}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {/* Площадки и диагностика */}
      {integration ? (
        <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Площадки и синхронизация
            </div>
            <Button
              variant="outline"
              onClick={() =>
                void patch(
                  { enabled: !integration.enabled },
                  integration.enabled ? "Синхронизация выключена" : "Синхронизация включена",
                )
              }
              disabled={saving || integration.enterprises.length === 0}
              className="h-10 rounded-2xl border-[#dcdfed] px-4 text-[14px]"
            >
              {integration.enabled ? "Выключить" : "Включить"} синхронизацию
            </Button>
          </div>

          {integration.enterprises.length === 0 ? (
            <p className="text-[13px] leading-[1.6] text-[#6f7282]">
              Площадки подтянутся из реестра «Цербер» при первой синхронизации.
              Пока их нет, включать синхронизацию нечему.
            </p>
          ) : (
            <ul className="space-y-2">
              {integration.enterprises.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#ececf4] px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-[#0b1024]">
                      {e.name}
                    </span>
                    {e.address ? (
                      <span className="block text-[12px] text-[#6f7282]">{e.address}</span>
                    ) : null}
                  </span>
                  <span className="text-[12px] text-[#6f7282]">
                    {e.buildingId
                      ? (buildings.find((b) => b.id === e.buildingId)?.name ?? "точка")
                      : "общий журнал"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-5 grid gap-3 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-[#6f7282]">ВСД получено</dt>
              <dd className="tabular-nums text-[#0b1024]">{integration.documentsCount}</dd>
            </div>
            <div>
              <dt className="text-[#6f7282]">В очереди заявок</dt>
              <dd className="tabular-nums text-[#0b1024]">{integration.queueCount}</dd>
            </div>
            <div>
              <dt className="text-[#6f7282]">Последняя синхронизация</dt>
              <dd className="text-[#0b1024]">
                {integration.lastSyncAt
                  ? new Date(integration.lastSyncAt).toLocaleString("ru-RU")
                  : "не было"}
              </dd>
            </div>
          </dl>

          {integration.lastSyncError ? (
            <p className="mt-3 rounded-2xl bg-[#fff4f2] px-4 py-3 text-[13px] text-[#a13a32]">
              {integration.lastSyncError}
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-[#116b2a]">
              <CheckCircle2 className="size-4" /> Ошибок нет
            </p>
          )}

          {users.length > 0 ? (
            <div className="mt-5">
              <Label className="text-[13px]">Кому напоминать о сроках</Label>
              <select
                defaultValue={integration.notifyUserId ?? ""}
                onChange={(e) =>
                  void patch(
                    { notifyUserId: e.target.value || null },
                    "Ответственный изменён",
                  )
                }
                className="mt-1.5 h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-3.5 text-[14px] sm:w-[320px]"
              >
                <option value="">Всё руководство</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
