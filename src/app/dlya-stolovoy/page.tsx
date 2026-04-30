import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-stolovoy");

export default function DlyaStolovoyPage() {
  return <NicheLanding slug="dlya-stolovoy" />;
}
