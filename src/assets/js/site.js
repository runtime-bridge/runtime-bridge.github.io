// Small enhancements; every page works without them.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// Day and night editions.
$(".theme")?.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "night" ? "day" : "night";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("rb-theme", next);
});

// Copy buttons on code blocks and the install line.
$$(".copy").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const box = btn.closest(".code, .install");
    const code = box?.querySelector("pre code, code");
    if (!code) return;
    const text = code.innerText.replace(/^\$ /gm, "");
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
      btn.classList.add("done");
      setTimeout(() => ((btn.textContent = "Copy"), btn.classList.remove("done")), 1400);
    } catch {
      btn.textContent = "Select and copy";
    }
  });
});

// Tabs: choosing a language switches every group on the page and is remembered.
function selectTab(name) {
  $$("[data-tabs]").forEach((group) => {
    const has = $$("[role=tab]", group).some((t) => t.dataset.tab === name);
    if (!has) return;
    $$("[role=tab]", group).forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    $$("[role=tabpanel]", group).forEach((p) => (p.hidden = p.dataset.panel !== name));
  });
}
$$("[data-tabs] [role=tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const top = tab.getBoundingClientRect().top;
    selectTab(tab.dataset.tab);
    localStorage.setItem("rb-tab", tab.dataset.tab);
    window.scrollBy(0, tab.getBoundingClientRect().top - top);
  });
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = $$("[role=tab]", tab.parentElement);
    const i = tabs.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1);
    const next = tabs[(i + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });
});
const remembered = localStorage.getItem("rb-tab");
if (remembered) selectTab(remembered);

// Sidebar on small screens.
$(".sidebar-toggle")?.addEventListener("click", (e) => {
  const side = e.target.closest(".sidebar");
  side.classList.toggle("open");
  e.target.setAttribute("aria-expanded", String(side.classList.contains("open")));
});

// Panels slide in as they come into view.
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
    { threshold: 0.12 },
  );
  $$(".reveal").forEach((el) => io.observe(el));
} else {
  $$(".reveal").forEach((el) => el.classList.add("in"));
}

// "On this page" follows the reader.
const tocLinks = $$(".toc a");
if (tocLinks.length && "IntersectionObserver" in window) {
  const byId = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        tocLinks.forEach((a) => a.classList.remove("on"));
        byId.get(e.target.id)?.classList.add("on");
      }
    },
    { rootMargin: "-90px 0px -70% 0px" },
  );
  byId.forEach((_, id) => {
    const h = document.getElementById(id);
    if (h) spy.observe(h);
  });
}

// Search over titles, headings and text of the docs.
const dialog = $(".search");
const input = $(".search input");
const list = $(".search-results");
let index = null;
let active = 0;

async function openSearch() {
  dialog.hidden = false;
  input.value = "";
  list.innerHTML = '<li class="search-empty">Type to search the docs.</li>';
  input.focus();
  if (!index) index = await fetch("/search.json").then((r) => r.json()).catch(() => []);
}
function closeSearch() {
  dialog.hidden = true;
}
function esc(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function search(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length || !index) return [];
  const hits = [];
  for (const p of index) {
    const hay = (p.t + " " + p.x).toLowerCase();
    if (words.every((w) => hay.includes(w))) hits.push({ title: p.t, url: p.u, sub: p.s, score: words.some((w) => p.t.toLowerCase().includes(w)) ? 3 : 1 });
    for (const [h, id] of p.h) {
      if (words.every((w) => h.toLowerCase().includes(w))) hits.push({ title: h, url: p.u + "#" + id, sub: p.t, score: 2 });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 12);
}
function render() {
  const hits = search(input.value);
  active = 0;
  list.innerHTML = hits.length
    ? hits.map((h, i) => `<li><a href="${h.url}"${i === 0 ? ' class="active"' : ""}>${esc(h.title)}<small>${esc(h.sub)}</small></a></li>`).join("")
    : `<li class="search-empty">${input.value ? "Nothing found. Try fewer words." : "Type to search the docs."}</li>`;
}
if (dialog) {
  $(".search-open")?.addEventListener("click", openSearch);
  input.addEventListener("input", render);
  dialog.addEventListener("click", (e) => e.target === dialog && closeSearch());
  input.addEventListener("keydown", (e) => {
    const links = $$("a", list);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!links.length) return;
      links[active]?.classList.remove("active");
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links[active].classList.add("active");
      links[active].scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter" && links[active]) location.href = links[active].href;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dialog.hidden) closeSearch();
    if (e.key === "/" && dialog.hidden && !/input|textarea/i.test(document.activeElement?.tagName ?? "")) {
      e.preventDefault();
      openSearch();
    }
  });
}
