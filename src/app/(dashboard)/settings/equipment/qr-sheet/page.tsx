import { redirect } from "next/navigation";

/**
 * Старый адрес листа QR-наклеек. Раскладка «наклейки сеткой» теперь живёт
 * на общей странице плакатов (`layout=sheet`) — там же есть выбор объектов
 * (`ids=`) и плакаты помещений. Ссылку оставляем ради закладок.
 */
export default async function EquipmentQrSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string }>;
}) {
  const { origin } = await searchParams;
  const search = new URLSearchParams({ kind: "equipment", layout: "sheet" });
  if (origin) search.set("origin", origin);
  redirect(`/settings/qr-posters?${search.toString()}`);
}
