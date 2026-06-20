/*
 * ui/Guide.ts — the slide-in Component Guide (the in-app manual).
 * Opened by the per-part ⓘ icons and the palette "Guide" button (any element
 * with [data-guide], handled by delegation). Quiet chrome, off-canvas, so it
 * never competes with the board (rule #5). Esc / backdrop / × all close it.
 */

import { GUIDE, GUIDE_ORDER, type GuideEntry, type TruthTable } from "./guide-content";

function truthHtml(t: TruthTable): string {
  const head = `<tr>${t.cols.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  const body = t.rows
    .map(
      (r) =>
        `<tr>${r
          .map((v) => {
            const cls = v === 1 ? " is-one" : v === 0 ? " is-zero" : "";
            return `<td class="t-cell${cls}">${v}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<table class="truth"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function entryHtml(e: GuideEntry): string {
  return `
    <h2 class="guide__h2">${e.title}</h2>
    <p class="guide__summary">${e.summary}</p>
    <h3 class="guide__h3">How it works</h3>
    ${e.how.map((p) => `<p>${p}</p>`).join("")}
    ${e.truth ? truthHtml(e.truth) : ""}
    <h3 class="guide__h3">How to use it</h3>
    <ul>${e.use.map((li) => `<li>${li}</li>`).join("")}</ul>
    <h3 class="guide__h3">Where it's used</h3>
    <ul>${e.where.map((li) => `<li>${li}</li>`).join("")}</ul>`;
}

function introHtml(): string {
  return `
    <h2 class="guide__h2">How this works</h2>
    <p>Logic Lab turns invisible signals into something you can see: a wire carrying a 1 glows amber and pulses, while a 0 stays a dim slate line.</p>
    <p>Pick a component below to learn what it does, its truth table, how to wire it, and where it shows up in real circuits.</p>
    <h3 class="guide__h3">Reading a truth table</h3>
    <p>Each row lists the inputs and the output they produce. <span class="t-cell is-one">1</span> means HIGH (on); <span class="t-cell is-zero">0</span> means LOW (off).</p>`;
}

export function initGuide(): void {
  const host = document.createElement("div");
  host.innerHTML = `
    <div class="guide-backdrop" id="guide-backdrop"></div>
    <aside class="guide" id="guide" role="dialog" aria-label="Component guide">
      <header class="guide__head">
        <span class="guide__title">Component Guide</span>
        <button class="guide__close" id="guide-close" aria-label="Close guide">&times;</button>
      </header>
      <nav class="guide__nav" id="guide-nav" aria-label="Components"></nav>
      <div class="guide__body" id="guide-body"></div>
    </aside>`;
  document.body.appendChild(host);

  const drawer = host.querySelector<HTMLElement>("#guide")!;
  const backdrop = host.querySelector<HTMLElement>("#guide-backdrop")!;
  const navEl = host.querySelector<HTMLElement>("#guide-nav")!;
  const bodyEl = host.querySelector<HTMLElement>("#guide-body")!;
  const closeBtn = host.querySelector<HTMLElement>("#guide-close")!;
  let current = "";

  const renderNav = (): void => {
    navEl.innerHTML = GUIDE_ORDER.map(
      (group) =>
        `<div class="guide__cat">${group.category}</div>` +
        group.types
          .map(
            (t) =>
              `<button class="guide__navitem${t === current ? " is-active" : ""}" data-nav="${t}">${GUIDE[t].title}</button>`,
          )
          .join(""),
    ).join("");
  };

  const renderBody = (): void => {
    bodyEl.innerHTML = current && GUIDE[current] ? entryHtml(GUIDE[current]) : introHtml();
    bodyEl.scrollTop = 0;
  };

  const open = (type: string): void => {
    current = type && GUIDE[type] ? type : "";
    renderNav();
    renderBody();
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    closeBtn.focus();
  };

  const close = (): void => {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
  };

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  navEl.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-nav]");
    if (b) {
      current = b.dataset.nav!;
      renderNav();
      renderBody();
    }
  });

  // Any [data-guide] affordance (palette ⓘ icons, the Guide button) opens the drawer.
  document.addEventListener("click", (e) => {
    const trigger = (e.target as Element).closest?.("[data-guide]");
    if (trigger) {
      e.preventDefault();
      open((trigger as HTMLElement).dataset.guide ?? "");
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) close();
  });
}
