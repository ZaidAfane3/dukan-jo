import Link from "next/link";
import { Fragment } from "react";

/* Pages Dukkan's team publishes for merchants (guides, news, rules), read in the merchant dashboard at /from-dukkan.
   Made in Diwan's marketing pages (/diwan/pages). Shared by the server (the rules) and the pages (the limits and how a
   page's text is shown).

   A page's text is plain text, never HTML:
   - a blank line starts a new paragraph
   - a line starting with "## " is a heading
   - lines starting with "- " are a list
   - [words](https://… or /path) is a link (only web addresses and Dukkan's own pages; anything else stays plain text) */

export * from "./dukkanPageRules";

const LINK = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g;
/** A link a page may have: a web address, or a page of Dukkan itself (/path, never //other-site) */
export const safeHref = (h: string) => /^https?:\/\/[^\s]+$/i.test(h) || /^\/(?!\/)[^\s]*$/.test(h);

function Inline({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of Array.from(text.matchAll(LINK))) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const [whole, words, href] = m;
    if (!safeHref(href)) out.push(whole);
    else if (href.startsWith("/"))
      out.push(<Link key={at} href={href} className="font-semibold text-primary underline underline-offset-2">{words}</Link>);
    else
      out.push(<a key={at} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-primary underline underline-offset-2">{words}</a>);
    last = at + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

type Block = { kind: "p"; lines: string[] } | { kind: "h"; text: string } | { kind: "ul"; items: string[] };

function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      cur = null;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h", text: line.slice(3).trim() });
      cur = null;
    } else if (/^\s*- /.test(line)) {
      const item = line.replace(/^\s*- /, "");
      if (cur?.kind === "ul") cur.items.push(item);
      else blocks.push((cur = { kind: "ul", items: [item] }));
    } else if (cur?.kind === "p") cur.lines.push(line);
    else blocks.push((cur = { kind: "p", lines: [line] }));
  }
  return blocks;
}

/** A page's text, shown safely (React text only) */
export function PageBody({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-4 text-[15px] leading-relaxed ${className}`}>
      {blocksOf(text).map((b, i) =>
        b.kind === "h" ? (
          <h2 key={i} className="pt-2 text-lg font-extrabold"><Inline text={b.text} /></h2>
        ) : b.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1.5 ps-5">
            {b.items.map((x, j) => <li key={j}><Inline text={x} /></li>)}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline text={l} />
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
