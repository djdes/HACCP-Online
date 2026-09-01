import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-otelya");

export default function DlyaOtelyaPage() {
  return <NicheLanding slug="dlya-otelya" />;
}
