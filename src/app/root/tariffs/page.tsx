import { requireRoot } from "@/lib/auth-helpers";
import { readTariffs } from "@/lib/tariffs";
import { TariffsClient } from "./tariffs-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Тарифы платформы",
};

/**
 * ROOT-админка цен. Лендинг, /pricing и создание платежа читают ту же
 * таблицу, поэтому смена цены применяется сразу после сохранения —
 * деплой не нужен.
 */
export default async function RootTariffsPage() {
  await requireRoot();
  const tariffs = await readTariffs();

  return (
    <div className="mx-auto max-w-[880px]">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">
        Тарифы платформы
      </h1>
      <p className="mt-2 text-[14px] leading-[1.6] text-[#6f7282]">
        Цены применяются мгновенно: лендинг, страница тарифов и кнопки
        оплаты читают эти значения при каждом запросе. Ключ тарифа менять
        нельзя — на него ссылаются кнопки оплаты и уже созданные заказы.
      </p>
      <div className="mt-6">
        <TariffsClient initial={tariffs} />
      </div>
    </div>
  );
}
