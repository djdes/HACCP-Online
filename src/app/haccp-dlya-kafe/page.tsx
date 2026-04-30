import { SeoJournalLanding, getSeoMetadata, SEO_LANDINGS } from "@/components/landing/seo-journal-landing";

const config = SEO_LANDINGS["haccp-dlya-kafe"];

export const metadata = getSeoMetadata(config);

export default function Page() {
  return <SeoJournalLanding config={config} />;
}
