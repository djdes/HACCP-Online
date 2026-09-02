import { redirect } from "next/navigation";

/** Ведомость живёт вкладкой на `/root/partners` — адрес из спецификации сохраняем. */
export default function RootPartnerPayoutsPage() {
  redirect("/root/partners?tab=payouts");
}
