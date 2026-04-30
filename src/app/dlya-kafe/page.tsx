import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-kafe");

export default function DlyaKafePage() {
  return <NicheLanding slug="dlya-kafe" />;
}
