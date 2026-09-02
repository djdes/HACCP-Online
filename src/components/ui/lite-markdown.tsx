import React from "react";

/**
 * Лёгкий безопасный рендер markdown-подмножества для чатов.
 *
 * AI-помощник и оператор пишут **жирным**, списками и `кодом` — плоский
 * текст в бабблах выглядел сыро (пользователь видел звёздочки). Полный
 * react-markdown тянуть незачем: нужно ровно то подмножество, которым
 * пользуется модель.
 *
 * Безопасность: вход НИКОГДА не попадает в HTML строкой — только React-
 * элементы, поэтому XSS через ответ модели/оператора невозможен
 * структурно, а не благодаря санитайзеру.
 *
 * Поддержано: **жирный**, *курсив*, `код`, заголовки (#..###),
 * маркированные (-, *, •) и нумерованные (1.) списки, абзацы.
 */

const INLINE_RE = /(\*\*(.+?)\*\*|`([^`\n]+)`|\*([^*\n]+)\*)/;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length > 0) {
    const match = INLINE_RE.exec(rest);
    if (!match || match.index === undefined) {
      nodes.push(rest);
      break;
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[2] !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderInline(match[2], key)}
        </strong>
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[0.92em]"
        >
          {match[3]}
        </code>
      );
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{renderInline(match[4], key)}</em>);
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return nodes;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; text: string };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const olMatch = trimmed.match(/^\d{1,3}[.)]\s+(.+)$/);
    const hMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (hMatch) {
      flush();
      blocks.push({ kind: "h", text: hMatch[1] });
    } else if (ulMatch) {
      if (current?.kind !== "ul") {
        flush();
        current = { kind: "ul", items: [] };
      }
      (current as { items: string[] }).items.push(ulMatch[1]);
    } else if (olMatch) {
      if (current?.kind !== "ol") {
        flush();
        current = { kind: "ol", items: [] };
      }
      (current as { items: string[] }).items.push(olMatch[1]);
    } else {
      if (current?.kind !== "p") {
        flush();
        current = { kind: "p", lines: [] };
      }
      (current as { lines: string[] }).lines.push(trimmed);
    }
  }
  flush();
  return blocks;
}

export function LiteMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <>
      {blocks.map((block, bi) => {
        if (block.kind === "h") {
          return (
            <p key={bi} className={`font-semibold ${bi > 0 ? "mt-2" : ""}`}>
              {renderInline(block.text, `h${bi}`)}
            </p>
          );
        }
        if (block.kind === "ul" || block.kind === "ol") {
          const List = block.kind === "ul" ? "ul" : "ol";
          return (
            <List
              key={bi}
              className={`${
                block.kind === "ul" ? "list-disc" : "list-decimal"
              } space-y-1 pl-4 ${bi > 0 ? "mt-1.5" : ""}`}
            >
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `b${bi}-${ii}`)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={bi} className={bi > 0 ? "mt-1.5" : ""}>
            {block.lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 ? <br /> : null}
                {renderInline(line, `b${bi}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
