import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-bara");

export default function DlyaBaraPage() {
  return <NicheLanding slug="dlya-bara" />;
}
