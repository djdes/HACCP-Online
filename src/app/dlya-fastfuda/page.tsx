import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-fastfuda");

export default function DlyaFastfudaPage() {
  return <NicheLanding slug="dlya-fastfuda" />;
}
