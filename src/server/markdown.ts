// Small Markdown renderer: headings, paragraphs, lists, fenced code, images,
// links, emphasis, inline code. Headings keep their text so /readme/ matches
// README.md.
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(raw: string): string {
  const codes: string[] = [];
  let s = esc(raw).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img alt="${alt}" src="${src}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

export function render(md: string): string {
  const out: string[] = [];
  const lines = md.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  let para: string[] = [];
  let list: "ul" | "ol" | null = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^ {0,3}(```|~~~)/);
    if (fence) {
      flushPara();
      closeList();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith(fence[1]); i++) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    const h = line.match(/^ {0,3}(#{1,6})\s+(.*?)(\s+#+)?\s*$/);
    if (h) {
      flushPara();
      closeList();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    const li = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      flushPara();
      const kind = /\d/.test(li[1]) ? "ol" : "ul";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline(li[2])}</li>`);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`);
      continue;
    }
    closeList();
    para.push(line.trim());
  }
  flushPara();
  closeList();
  return out.join("\n");
}
