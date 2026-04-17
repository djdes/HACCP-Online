/**
 * Typed content blocks for a blog article. Storing bodies as a structured
 * array instead of Markdown or free-form HTML means we never ship a parser
 * or a sanitiser, and the renderer can style each block exactly like the
 * rest of the login-style design system.
 */
export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string; author?: string }
  | { type: "callout"; tone?: "info" | "warn" | "tip"; title?: string; text: string };

export type ArticleRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: ArticleBlock[];
  coverIcon: string | null;
  tags: string[];
  readMinutes: number;
  publishedAt: Date | null;
};

/// Narrow runtime guard — validate a JSON blob from Prisma is a valid blocks
/// array shape. Used by the admin API to reject malformed payloads before
/// they land in the DB.
export function isArticleBlockArray(value: unknown): value is ArticleBlock[] {
  if (!Array.isArray(value)) return false;
  return value.every((block) => {
    if (!block || typeof block !== "object") return false;
    const b = block as Record<string, unknown>;
    switch (b.type) {
      case "p":
      case "h2":
      case "h3":
        return typeof b.text === "string";
      case "ul":
      case "ol":
        return (
          Array.isArray(b.items) &&
          b.items.every((it) => typeof it === "string")
        );
      case "quote":
        return (
          typeof b.text === "string" &&
          (b.author === undefined || typeof b.author === "string")
        );
      case "callout":
        return (
          typeof b.text === "string" &&
          (b.title === undefined || typeof b.title === "string") &&
          (b.tone === undefined ||
            b.tone === "info" ||
            b.tone === "warn" ||
            b.tone === "tip")
        );
      default:
        return false;
    }
  });
}
