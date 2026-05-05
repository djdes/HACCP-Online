"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

type Equipment = {
  id: string;
  name: string;
  type: string;
  tempMin: number | null;
  tempMax: number | null;
  tuyaDeviceId: string | null;
  area: { name: string };
};

export default function MiniIotPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/mini/iot", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setEquipment(data.equipment ?? []);
      } catch {
        setError("Не удалось загрузить оборудование");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div
        className="flex flex-1 items-center justify-center text-[14px]"
        style={{ color: "var(--mini-text-muted)" }}
      >
        <Loader2
          className="mr-2 size-4 animate-spin"
          style={{ color: "var(--mini-lime)" }}
        />
        Загружаем…
      </div>
    );
  }
  if (error)
    return (
      <div
        className="rounded-2xl px-4 py-3 text-[13px]"
        style={{
          background: "var(--mini-crimson-soft)",
          border: "1px solid rgba(255, 82, 104, 0.24)",
          color: "var(--mini-crimson)",
        }}
      >
        {error}
      </div>
    );

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <Link
        href="/mini"
        className="inline-flex items-center gap-1 text-[13px] font-medium"
        style={{ color: "var(--mini-text-muted)" }}
      >
        <ArrowLeft className="size-4" />
        На главную
      </Link>

      <header className="px-1">
        <h1
          className="text-[20px] font-semibold"
          style={{ color: "var(--mini-text)" }}
        >
          IoT Мониторинг
        </h1>
        <p
          className="mt-0.5 text-[13px]"
          style={{ color: "var(--mini-text-muted)" }}
        >
          Оборудование с датчиками
        </p>
      </header>

      {equipment.length === 0 ? (
        <div
          className="rounded-2xl px-4 py-6 text-center text-[14px]"
          style={{
            background: "var(--mini-surface-1)",
            border: "1px dashed var(--mini-divider-strong)",
            color: "var(--mini-text-muted)",
          }}
        >
          Нет подключённого оборудования с датчиками.
        </div>
      ) : (
        <section className="space-y-3">
          {equipment.map((eq) => (
            <div
              key={eq.id}
              className="rounded-2xl px-4 py-3"
              style={{
                background: "var(--mini-card-solid-bg)",
                border: "1px solid var(--mini-divider)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[15px] font-medium"
                  style={{ color: "var(--mini-text)" }}
                >
                  {eq.name}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: eq.tuyaDeviceId
                      ? "var(--mini-sage-soft)"
                      : "var(--mini-surface-2)",
                    color: eq.tuyaDeviceId
                      ? "var(--mini-sage)"
                      : "var(--mini-text-muted)",
                  }}
                >
                  {eq.tuyaDeviceId ? "Подключено" : "—"}
                </span>
              </div>
              <p
                className="mt-0.5 text-[13px]"
                style={{ color: "var(--mini-text-muted)" }}
              >
                {eq.area.name}
              </p>
              {eq.tempMin != null && eq.tempMax != null ? (
                <div className="mt-2 flex items-center gap-2 text-[13px]">
                  <span style={{ color: "var(--mini-text-muted)" }}>Норма:</span>
                  <span
                    className="font-medium"
                    style={{ color: "var(--mini-text)" }}
                  >
                    {eq.tempMin}…{eq.tempMax}°C
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
