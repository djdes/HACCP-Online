import { requireRoot } from "@/lib/auth-helpers";
import { readServices } from "@/lib/services/catalog";
import { ServicesAdmin } from "./services-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Услуги платформы",
};

/**
 * ROOT-админка каталога услуг.
 *
 * Публичная /uslugi и раздел в кабинете читают ту же таблицу при каждом
 * запросе, поэтому правка цены применяется сразу — деплой не нужен.
 */
export default async function RootServicesPage() {
  await requireRoot();
  const services = await readServices();

  return (
    <div className="mx-auto max-w-[980px]">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">
        Услуги платформы
      </h1>
      <p className="mt-2 text-[14px] leading-[1.6] text-[#6f7282]">
        Цены и тексты применяются мгновенно: страница «Услуги» в кабинете и
        публичная /uslugi читают эти значения при каждом запросе. Ключ
        услуги менять нельзя — на него ссылаются уже созданные заявки.
        Пустая цена означает «по запросу».
      </p>
      <div className="mt-6">
        <ServicesAdmin initial={services} />
      </div>
    </div>
  );
}
