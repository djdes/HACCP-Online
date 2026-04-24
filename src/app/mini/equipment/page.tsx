"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Package, Thermometer } from "lucide-react";

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
      <div className="flex flex-1 items-center justify-center text-sm text-[#6f7282]">
        Загружаем…
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold text-[#0b1024]">Ошибка</h1>
        <p className="text-sm text-[#a13a32]">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <header className="rounded-3xl border border-[#ececf4] bg-white px-5 py-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
          Справочник
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Оборудование
        </h1>
      </header>

      <section className="space-y-2">
        {state.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-7 text-center text-[14px] text-[#6f7282]">
            Пока нет оборудования.
          </div>
        ) : (
          state.items.map((item: EquipmentItem) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
                {item.type?.toLowerCase().includes("темп") ? (
                  <Thermometer className="size-5" />
                ) : (
                  <Package className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-[#0b1024]">
                  {item.name}
                </p>
                <p className="text-[13px] text-[#6f7282]">
                  {item.type || "—"} · {item.areaName}
                </p>
              </div>
            </div>
          ))
        )}
      </section>


    </div>
  );
}
