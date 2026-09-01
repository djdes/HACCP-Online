import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-azs");

export default function DlyaAzsPage() {
  return <NicheLanding slug="dlya-azs" />;
}
