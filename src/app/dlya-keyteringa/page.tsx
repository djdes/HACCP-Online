import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-keyteringa");

export default function DlyaKeyteringaPage() {
  return <NicheLanding slug="dlya-keyteringa" />;
}
