import "./styles/tokens.css";
import "./styles/app.css";
import { mountCanvas } from "./canvas/Canvas";
import { initInteractions } from "./canvas/interactions";
import { initPalette } from "./ui/Palette";
import { initStatusBar } from "./ui/StatusBar";
import { getState, subscribe, loadCircuit } from "./store";
import { createAutosaver, loadCurrent } from "./storage/local";

/*
 * Phase 1 — a circuit that works. main.ts builds the shell, mounts the canvas,
 * and wires the palette / rails / status bar to the store. Topbar file actions
 * are still stubs (is-stub) — they come alive in Phases 2–3.
 */

interface PaletteItem {
  label: string;
  type?: string; // present → live part; absent → "coming in a later phase"
}
interface PaletteCategory {
  name: string;
  open?: boolean;
  items: PaletteItem[];
}

const PALETTE: PaletteCategory[] = [
  {
    name: "Gates",
    open: true,
    items: [
      { label: "AND", type: "and" },
      { label: "OR", type: "or" },
      { label: "NOT", type: "not" },
      { label: "NAND" },
      { label: "NOR" },
      { label: "XOR" },
      { label: "XNOR" },
    ],
  },
  {
    name: "I/O",
    open: true,
    items: [{ label: "Input", type: "input" }, { label: "Output", type: "output" }, { label: "Clock" }],
  },
  { name: "Display", items: [{ label: "7-segment" }, { label: "Number" }] },
  {
    name: "Arithmetic",
    items: [
      { label: "Half adder" },
      { label: "Full adder" },
      { label: "n-bit adder" },
      { label: "Subtractor" },
    ],
  },
  { name: "Selectors", items: [{ label: "2:1 MUX" }, { label: "4:1 MUX" }, { label: "Decoder" }] },
  { name: "Atoms", items: [{ label: "NMOS" }, { label: "PMOS" }] },
];

const chevron = `<svg class="cat__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2 l4 4 l-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function paletteCategory(cat: PaletteCategory): string {
  const items = cat.items
    .map((it) =>
      it.type
        ? `<button class="chip" data-type="${it.type}">${it.label}</button>`
        : `<button class="chip is-soon" title="Coming in a later phase">${it.label}</button>`,
    )
    .join("");
  return `<details class="cat"${cat.open ? " open" : ""}>
      <summary>${chevron}<span>${cat.name}</span></summary>
      <div class="cat__items">${items}</div>
    </details>`;
}

function shell(): string {
  return `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand__mark">&#9671;</span> Logic Lab</div>
      <div class="topbar__group">
        <button class="btn is-stub" title="Coming in Phase 2">New</button>
        <button class="btn is-stub" title="Coming in Phase 2">Save</button>
        <button class="btn is-stub" title="Coming in Phase 3">Open &#9662;</button>
        <button class="btn is-stub" title="Coming in Phase 3">Export</button>
        <button class="btn is-stub" title="Coming in Phase 3">Import</button>
      </div>
      <div class="topbar__spacer"></div>
      <div class="live" title="Simulation runs continuously"><span class="live__dot"></span> Live</div>
    </header>

    <main class="workspace">
      <aside class="palette" aria-label="Component library">
        <div class="palette__title">Components</div>
        ${PALETTE.map(paletteCategory).join("")}
      </aside>

      <section class="board-area">
        <div class="rail-band rail-band--in" aria-label="Input rail">
          <span class="rail-band__label">Inputs</span>
          <button class="rail-band__add" data-type="input">+ Add input</button>
        </div>

        <div class="board-center">
          <div class="empty-state">
            <div class="empty-state__mark">&#9671;</div>
            <div class="empty-state__line">A blank board, ready for a circuit.</div>
            <div class="empty-state__hint">
              Click a gate on the left to drop it, or add an input. Drag from an
              output terminal to an input terminal to wire them up.
            </div>
          </div>
        </div>

        <div class="rail-band rail-band--out" aria-label="Output rail">
          <span class="rail-band__label">Outputs</span>
          <button class="rail-band__add" data-type="output">+ Add output</button>
        </div>
      </section>
    </main>

    <footer class="statusbar">
      <span id="sb-count">0 components · 0 wires</span>
      <div class="statusbar__spacer"></div>
      <span id="sb-meta">zoom 100% · not saved yet</span>
    </footer>
  </div>`;
}

const root = document.getElementById("app");
if (!root) throw new Error("Logic Lab: #app root element not found");
root.innerHTML = shell();

const boardArea = root.querySelector<HTMLElement>(".board-area")!;
mountCanvas(boardArea);
const status = initStatusBar();
initInteractions(status.setMessage);
initPalette();

// Phase 2 — don't-lose-my-work: autosave on every change, restore on load.
const autosaver = createAutosaver({ onSaved: status.setSaved, onError: status.setMessage });
subscribe(() => autosaver.schedule(getState().circuit));

const restored = loadCurrent();
if (restored) loadCircuit(restored);

// Ctrl/Cmd+S forces an immediate save (spec §7).
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    autosaver.flush(getState().circuit);
  }
});
