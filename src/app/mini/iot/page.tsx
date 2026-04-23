"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

  if (loading) return <div className="text-center text-sm text-slate-500">Загружаем…</div>;
  if (error)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <Link href="/mini" className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500">
        <ArrowLeft className="size-4" />
        На главную
      </Link>

      <header className="px-1">
        <h1 className="text-[20px] font-semibold text-slate-900">IoT Мониторинг</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">Оборудование с датчиками</p>
      </header>

      {equipment.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-[14px] text-slate-500">
          Нет подключённого оборудования с датчиками.
        </div>
      ) : (
        <section className="space-y-3">
          {equipment.map((eq) => (
            <div key={eq.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-slate-900">{eq.name}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  {eq.tuyaDeviceId ? "Подключено" : "—"}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-slate-500">{eq.area.name}</p>
              {eq.tempMin != null && eq.tempMax != null ? (
                <div className="mt-2 flex items-center gap-2 text-[13px]">
                  <span className="text-slate-500">Норма:</span>
                  <span className="font-medium text-slate-700">
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
