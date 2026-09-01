import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-magazina");

export default function DlyaMagazinaPage() {
  return <NicheLanding slug="dlya-magazina" />;
}
