import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-detskogo-sada");

export default function DlyaDetskogoSadaPage() {
  return <NicheLanding slug="dlya-detskogo-sada" />;
}
