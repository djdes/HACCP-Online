import { NicheLanding, getNicheMetadata } from "@/components/landing/niche-landing";

export const metadata = getNicheMetadata("dlya-pekarni");

export default function DlyaPekarniPage() {
  return <NicheLanding slug="dlya-pekarni" />;
}
