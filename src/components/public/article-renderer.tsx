import type { ArticleBlock } from "@/lib/article-blocks";

const calloutTone: Record<
  NonNullable<Extract<ArticleBlock, { type: "callout" }>["tone"]>,
  { bg: string; border: string; fg: string }
> = {
  info: { bg: "#eef1ff", border: "#c7ccea", fg: "#3848c7" },
  warn: { bg: "#fff4f2", border: "#ffd2cd", fg: "#a13a32" },
  tip: { bg: "#ecfdf5", border: "#c8f0d5", fg: "#116b2a" },
};

export function ArticleRenderer({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="space-y-5 text-[16px] leading-[1.7] text-[#3c4053]">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "p":
            return (
              <p key={idx}>
                {block.text}
              </p>
            );
          case "h2":
            return (
              <h2
                key={idx}
                className="mt-10 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[#0b1024]"
              >
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={idx}
                className="mt-6 text-[19px] font-semibold leading-tight text-[#0b1024]"
              >
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={idx} className="list-disc space-y-2 pl-6">
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="list-decimal space-y-2 pl-6">
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={idx}
                className="rounded-2xl border-l-4 border-[#5566f6] bg-[#f5f6ff] px-5 py-4 text-[#3c4053]"
              >
                <p className="italic">«{block.text}»</p>
                {block.author ? (
                  <p className="mt-2 text-[13px] font-medium text-[#6f7282]">
                    — {block.author}
                  </p>
                ) : null}
              </blockquote>
            );
          case "callout": {
            const tone = calloutTone[block.tone ?? "info"];
            return (
              <div
                key={idx}
                className="rounded-2xl border px-5 py-4"
                style={{ backgroundColor: tone.bg, borderColor: tone.border }}
              >
                {block.title ? (
                  <div
                    className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider"
                    style={{ color: tone.fg }}
                  >
                    {block.title}
                  </div>
                ) : null}
                <p style={{ color: tone.fg }}>{block.text}</p>
              </div>
            );
          }
        }
      })}
    </div>
  );
}
