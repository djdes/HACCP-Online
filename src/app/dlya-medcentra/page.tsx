import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-medcentra");

export default function DlyaMedcentraPage() {
  return <NicheLanding slug="dlya-medcentra" />;
}
