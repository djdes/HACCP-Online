"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type EquipmentItem = {
  id: string;
  name: string;
  type: string | null;
  areaName: string;
};

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: EquipmentItem[] };

export default function MiniEquipmentPage() {
  const { status } = useSession();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/mini/equipment", { cache: "no-store" })
      .then(async (resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        setState({ kind: "ready", items: data.equipment });
      })
      .catch((err) =>
        setState({ kind: "error", message: err.message || "Ошибка" })
      );
  }, [status]);

  if (state.kind === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Загружаем…
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold">Ошибка</h1>
        <p className="text-sm text-red-500">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <header className="pt-2">
        <h1 className="text-[22px] font-semibold text-slate-900">Оборудование</h1>
      </header>

      <section className="space-y-2">
        {state.items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-[14px] text-slate-500">
            Пока нет оборудования.
          </div>
        ) : (
          state.items.map((item: EquipmentItem) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-[15px] font-medium text-slate-900">
                {item.name}
              </p>
              <p className="text-[13px] text-slate-500">
                {item.type || "—"} · {item.areaName}
              </p>
            </div>
          ))
        )}
      </section>


    </div>
  );
}
