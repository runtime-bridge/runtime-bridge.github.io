// Builds the site into dist/. No dependencies: the docs are written in a
// small Markdown dialect rendered here, code is highlighted at build time,
// and a search index is written for the docs search box.
//
//   node build.mjs            build into dist/
//   node build.mjs --serve    build, then serve dist/ on http://localhost:4173

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, "src");
const out = path.join(root, "dist");
const site = {
  name: "rbridge",
  url: "https://runtime-bridge.github.io",
  repo: "https://github.com/runtime-bridge/rbridge",
  org: "https://github.com/runtime-bridge",
};

// ---------- text helpers ----------

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) =>
  s.toLowerCase().replace(/<[^>]+>/g, "").replace(/`/g, "").replace(/[^a-z0-9 -]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");

function inline(text) {
  // Links first, so their text may hold code; then code spans, so nothing
  // inside them is formatted.
  const links = [];
  text = text.replace(/\[((?:`[^`]*`|[^\]])+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const ext = /^https?:/.test(url);
    links.push(`<a href="${esc(url)}"${ext ? ' rel="noopener"' : ""}>${inline(label)}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });
  const html = text
    .split(/(`[^`]+`)/)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return `<code>${esc(part.slice(1, -1))}</code>`;
      let s = esc(part);
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
      return s;
    })
    .join("");
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

// ---------- syntax highlighting ----------

const kw = (words) => new RegExp(`\\b(?:${words.split(" ").join("|")})\\b`, "y");
const common = {
  dq: [/"(?:\\.|[^"\\\n])*"/y, "s"],
  sq: [/'(?:\\.|[^'\\\n])*'/y, "s"],
  bt: [/`[^`]*`/y, "s"],
  num: [/\b\d+(?:\.\d+)?(?:ms|s|m|h)?\b/y, "n"],
};
const langs = {
  sh: [
    [/#.*/y, "c"], common.dq, common.sq,
    [/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/y, "v"],
    [/(?<=^|\n|\|\s?|&&\s?|\$\s)(?:rbridge|go|npm|node|pip|python3?|curl|git|export|cd|echo|brew|scoop|docker|make|cat|jq)\b/y, "f"],
    [/(?<=\s)--?[A-Za-z][\w-]*/y, "k"],
  ],
  go: [
    [/\/\/.*/y, "c"], common.dq, common.bt,
    [kw("package import func return if else for range var const type struct interface map chan go defer select case switch default break continue nil true false err"), "k"],
    [/\b[A-Z][A-Za-z0-9]*(?=\()/y, "f"], [/\b[a-z][A-Za-z0-9]*(?=\()/y, "f"], common.num,
  ],
  js: [
    [/\/\/.*/y, "c"], common.dq, common.sq, common.bt,
    [kw("import from export const let var function return if else for of in await async new try catch finally throw class extends null undefined true false typeof"), "k"],
    [/\b[A-Za-z_$][\w$]*(?=\()/y, "f"], common.num,
  ],
  py: [
    [/#.*/y, "c"], [/"""[\s\S]*?"""/y, "s"], common.dq, common.sq,
    [kw("import from as def return if elif else for in while with try except finally raise class lambda None True False and or not is pass print"), "k"],
    [/\b[A-Za-z_]\w*(?=\()/y, "f"], common.num,
  ],
  json: [[/"(?:\\.|[^"\\])*"(?=\s*:)/y, "k"], common.dq, [kw("true false null"), "k"], common.num],
  yaml: [[/#.*/y, "c"], [/^[ \t-]*[A-Za-z_][\w.-]*(?=:)/my, "k"], common.dq, common.sq, [kw("true false null"), "k"], common.num],
  http: [[/^(?:GET|POST|PUT|DELETE)\b/my, "k"], [/^[A-Za-z-]+(?=:)/my, "f"], common.dq],
  text: [],
};
langs.ts = langs.js;
langs.python = langs.py;
langs.bash = langs.sh;

function highlight(code, lang) {
  const rules = langs[lang] ?? [];
  let html = "";
  let i = 0;
  let plain = "";
  outer: while (i < code.length) {
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length > 0) {
        html += esc(plain);
        plain = "";
        html += `<span class="t-${cls}">${esc(m[0])}</span>`;
        i += m[0].length;
        continue outer;
      }
    }
    plain += code[i++];
  }
  return html + esc(plain);
}

function codeBlock(lang, title, code) {
  const label = title || { sh: "Terminal", go: "Go", js: "JavaScript", ts: "TypeScript", py: "Python", json: "JSON", yaml: "YAML", http: "HTTP" }[lang] || "";
  return `<figure class="code"><figcaption><span>${esc(label)}</span><button class="copy" type="button" aria-label="Copy code">Copy</button></figcaption><pre><code class="lang-${lang}">${highlight(code, lang)}</code></pre></figure>`;
}

// ---------- Markdown dialect ----------

function parseFence(line) {
  const m = /^```(\w*)(?:\s+title="([^"]*)")?\s*$/.exec(line);
  return m ? { lang: m[1] || "text", title: m[2] || "" } : null;
}

function markdown(text, toc) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  const para = [];
  const flush = () => {
    if (para.length) html += `<p>${inline(para.join(" "))}</p>\n`;
    para.length = 0;
  };
  const readFence = (start) => {
    const f = parseFence(lines[start]);
    const body = [];
    let j = start + 1;
    while (j < lines.length && lines[j] !== "```") body.push(lines[j++]);
    return { ...f, code: body.join("\n"), end: j + 1 };
  };
  let tabGroup = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flush();
      const f = readFence(i);
      html += codeBlock(f.lang, f.title, f.code);
      i = f.end;
      continue;
    }
    if (line === ":::tabs") {
      flush();
      const tabs = [];
      i++;
      while (i < lines.length && lines[i] !== ":::") {
        if (lines[i].startsWith("```")) {
          const f = readFence(i);
          tabs.push(f);
          i = f.end;
        } else i++;
      }
      i++;
      tabGroup++;
      const names = tabs.map((t) => t.title || t.lang);
      html += `<div class="tabs" data-tabs>`;
      html += `<div class="tab-list" role="tablist">${names
        .map((n, k) => `<button role="tab" type="button" data-tab="${esc(n)}" aria-selected="${k === 0}">${esc(n)}</button>`)
        .join("")}</div>`;
      html += tabs
        .map((t, k) => `<div class="tab-panel" role="tabpanel" data-panel="${esc(names[k])}"${k ? " hidden" : ""}>${codeBlock(t.lang, t.title, t.code)}</div>`)
        .join("");
      html += `</div>\n`;
      continue;
    }
    const callout = /^:::(note|tip|warn)(?:\s+(.*))?$/.exec(line);
    if (callout) {
      flush();
      const body = [];
      i++;
      while (i < lines.length && lines[i] !== ":::") body.push(lines[i++]);
      i++;
      const label = callout[2] || { note: "Note", tip: "Tip", warn: "Careful" }[callout[1]];
      html += `<aside class="callout callout-${callout[1]}"><div class="callout-label">${esc(label)}</div>${markdown(body.join("\n"), null)}</aside>\n`;
      continue;
    }
    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      const id = slug(h[2]);
      if (toc && level <= 3) toc.push({ level, id, text: h[2].replace(/`/g, "") });
      html += `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inline(h[2])}</h${level}>\n`;
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, "|")));
      const head = cells(rows[0]);
      html += `<div class="table"><table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>`;
      for (const r of rows.slice(2)) html += `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`;
      html += `</tbody></table></div>\n`;
      continue;
    }
    const li = /^(\s*)(?:- |(\d+)\. )(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = li[2] !== undefined;
      const items = [];
      while (i < lines.length) {
        const m = /^(?:- |\d+\. )(.*)$/.exec(lines[i]);
        if (m) items.push(m[1]);
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1] += " " + lines[i].trim();
        else break;
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      html += `<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>\n`;
      continue;
    }
    if (line.trim() === "") {
      flush();
      i++;
      continue;
    }
    if (line.startsWith("<")) {
      flush();
      html += line + "\n";
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return html;
}

function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const meta = {};
  if (!m) return { meta, body: text };
  for (const l of m[1].split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(l);
    if (kv) meta[kv[1]] = kv[2];
  }
  return { meta, body: text.slice(m[0].length) };
}

// ---------- layout ----------

const sections = ["Start here", "Use it", "Concepts", "Reference"];

function head({ title, description, pathname }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${site.url}/assets/img/logo-light.png">
<link rel="canonical" href="${site.url}${pathname}">
<link rel="icon" href="/assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css">
<script>document.documentElement.dataset.theme=localStorage.getItem("rb-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"night":"day")</script>
</head>`;
}

function topbar(active) {
  const link = (href, label, key) => `<a href="${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="topbar">
  <a class="brand" href="/"><img src="/assets/img/mark.png" alt="" width="54" height="20"><span>rbridge</span></a>
  <nav class="topnav" aria-label="Main">
    ${link("/docs/", "Docs", "docs")}
    ${link("/docs/cli/", "CLI", "cli")}
    ${link("/docs/sdks/", "SDKs", "sdks")}
    ${link("/docs/examples/", "Examples", "examples")}
    <a href="${site.repo}" rel="noopener">GitHub</a>
  </nav>
  <div class="topbar-tools">
    <button class="search-open" type="button" aria-label="Search the docs"><span>Search</span><kbd>/</kbd></button>
    <button class="theme" type="button" aria-label="Switch between day and night"><span class="sun">Day</span><span class="moon">Night</span></button>
  </div>
</header>
<div class="search" hidden role="dialog" aria-label="Search the docs">
  <div class="search-box"><input type="search" placeholder="Search the docs" aria-label="Search"><ol class="search-results"></ol></div>
</div>`;
}

const footer = `<footer class="footer">
  <div class="footer-inner">
    <div><strong>rbridge</strong> is free and open source under the Apache 2.0 licence.<br>It never touches your credentials.</div>
    <nav aria-label="Footer">
      <a href="/docs/">Docs</a><a href="${site.repo}" rel="noopener">GitHub</a>
      <a href="https://github.com/runtime-bridge/rbridge-sdk-ts" rel="noopener">Node.js SDK</a>
      <a href="https://github.com/runtime-bridge/rbridge-sdk-python" rel="noopener">Python SDK</a>
      <a href="${site.repo}/security/advisories/new" rel="noopener">Report a security issue</a>
    </nav>
  </div>
</footer>
<script src="/assets/js/site.js" defer></script>
</body>
</html>`;

function docPage(page, pages) {
  const nav = sections
    .map((sec) => {
      const items = pages.filter((p) => p.meta.section === sec);
      if (!items.length) return "";
      return `<div class="side-group"><div class="side-title">${esc(sec)}</div><ul>${items
        .map((p) => `<li><a href="${p.url}"${p === page ? ' aria-current="page"' : ""}>${esc(p.meta.title)}</a></li>`)
        .join("")}</ul></div>`;
    })
    .join("");
  const idx = pages.indexOf(page);
  const prev = pages[idx - 1];
  const next = pages[idx + 1];
  const toc = page.toc.filter((t) => t.level === 2);
  const active = { cli: "cli", sdks: "sdks", examples: "examples" }[page.slug] ?? "docs";
  return `${head({ title: `${page.meta.title} - rbridge docs`, description: page.meta.description || "rbridge documentation", pathname: page.url })}
<body class="docs-body">
${topbar(active)}
<div class="docs">
  <aside class="sidebar" aria-label="Documentation">
    <button class="sidebar-toggle" type="button" aria-expanded="false">Contents</button>
    <nav>${nav}</nav>
  </aside>
  <main class="doc" id="main">
    <div class="doc-kicker">${esc(page.meta.section)}</div>
    <h1>${inline(page.meta.title)}</h1>
    ${page.meta.description ? `<p class="lede">${inline(page.meta.description)}</p>` : ""}
    ${page.html}
    <nav class="pager" aria-label="Pages">
      ${prev ? `<a class="prev" href="${prev.url}"><small>Previous</small>${esc(prev.meta.title)}</a>` : "<span></span>"}
      ${next ? `<a class="next" href="${next.url}"><small>Next</small>${esc(next.meta.title)}</a>` : "<span></span>"}
    </nav>
    <p class="edit"><a href="https://github.com/runtime-bridge/runtime-bridge.github.io/edit/main/src/docs/${page.file}" rel="noopener">Improve this page on GitHub</a></p>
  </main>
  <aside class="toc" aria-label="On this page">
    ${toc.length ? `<div class="toc-title">On this page</div><ul>${toc.map((t) => `<li><a href="#${t.id}">${inline(t.text)}</a></li>`).join("")}</ul>` : ""}
  </aside>
</div>
${footer}`;
}

// ---------- build ----------

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function write(rel, content) {
  const p = path.join(out, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

export function build() {
  fs.rmSync(out, { recursive: true, force: true });
  copyDir(path.join(src, "assets"), path.join(out, "assets"));

  const pages = fs
    .readdirSync(path.join(src, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const { meta, body } = frontMatter(fs.readFileSync(path.join(src, "docs", file), "utf8"));
      const s = file.replace(/^\d+-/, "").replace(/\.md$/, "");
      const toc = [];
      const html = markdown(body, toc);
      const url = s === "introduction" ? "/docs/" : `/docs/${s}/`;
      return { file, slug: s, meta, html, toc, url, text: body };
    })
    .sort((a, b) => sections.indexOf(a.meta.section) - sections.indexOf(b.meta.section) || Number(a.meta.order) - Number(b.meta.order));

  for (const p of pages) {
    if (!sections.includes(p.meta.section)) throw new Error(`${p.file}: unknown section ${p.meta.section}`);
    write(path.join(p.url, "index.html"), docPage(p, pages));
  }

  const landing = fs.readFileSync(path.join(src, "index.html"), "utf8");
  write(
    "index.html",
    landing
      .replace("{{head}}", head({ title: "rbridge: one bridge to every agent runtime on your machine", description: "Use the agent runtimes you already have (Claude Code, OpenCode, Codex, Gemini CLI, any ACP agent) from any software, with skills, policy and audit. Free, open source, local first.", pathname: "/" }))
      .replace("{{topbar}}", topbar("home"))
      .replace("{{footer}}", footer)
      .replace(/\{\{code:(\w+)\}\}([\s\S]*?)\{\{\/code\}\}/g, (_, lang, code) => highlight(code.replace(/^\n/, ""), lang)),
  );
  write("404.html", `${head({ title: "Lost in another universe - rbridge", description: "Page not found", pathname: "/404.html" })}
<body>${topbar("")}<main class="lost"><div class="burst">404</div><h1>This panel was never drawn.</h1><p><a class="btn" href="/">Back to the front page</a> <a class="btn btn-ghost" href="/docs/">Read the docs</a></p></main>${footer}`);

  // Search index: page titles, headings and a stripped excerpt.
  const index = pages.map((p) => ({
    t: p.meta.title,
    u: p.url,
    s: p.meta.section,
    h: p.toc.map((t) => [t.text, t.id]),
    x: p.text.replace(/```[\s\S]*?```/g, " ").replace(/[#*`|>:[\]()-]/g, " ").replace(/\s+/g, " ").slice(0, 4000),
  }));
  write("search.json", JSON.stringify(index));
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", ...pages.map((p) => p.url)].map((u) => `  <url><loc>${site.url}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  write(".nojekyll", "");
  return pages.length;
}

const n = build();
console.log(`built ${n} docs pages into dist/`);

if (process.argv.includes("--serve")) {
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml" };
  http
    .createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(out, path.normalize(p));
      if (!file.startsWith(out) || !fs.existsSync(file)) {
        res.writeHead(404, { "content-type": "text/html" });
        return res.end(fs.readFileSync(path.join(out, "404.html")));
      }
      res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
      res.end(fs.readFileSync(file));
    })
    .listen(4173, () => console.log("serving http://localhost:4173"));
}
