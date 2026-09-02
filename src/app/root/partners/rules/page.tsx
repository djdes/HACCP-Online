import { redirect } from "next/navigation";

/** Правила живут вкладкой на `/root/partners` — адрес из спецификации сохраняем. */
export default function RootPartnerRulesPage() {
  redirect("/root/partners?tab=rules");
}
