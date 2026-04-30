import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-proizvodstva");

export default function DlyaProizvodstvaPage() {
  return <NicheLanding slug="dlya-proizvodstva" />;
}
