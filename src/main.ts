import "./styles/tokens.css";
import "./styles/app.css";

/*
 * Phase 0 — the static shell. This renders the five regions (spec §4) on-brand
 * with no behavior yet. Later phases replace these stubs with live modules
 * (Palette, Rails, Canvas, ...) driven by the store. The sample rail entries
 * exist only to showcase the amber/slate signal system; they carry no logic.
 */

interface PaletteItem {
  label: string;
  ready?: boolean; // false/undefined → "coming in a later phase"
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
      { label: "AND", ready: true },
      { label: "OR", ready: true },
      { label: "NOT", ready: true },
      { label: "NAND" },
      { label: "NOR" },
      { label: "XOR" },
      { label: "XNOR" },
    ],
  },
  {
    name: "I/O",
    open: true,
    items: [{ label: "Input", ready: true }, { label: "Output", ready: true }, { label: "Clock" }],
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
    .map(
      (it) =>
        `<button class="chip${it.ready ? "" : " is-soon"}"${
          it.ready ? "" : ' title="Coming in a later phase"'
        }>${it.label}</button>`,
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
        <button class="btn">New</button>
        <button class="btn">Save</button>
        <button class="btn">Open &#9662;</button>
        <button class="btn">Export</button>
        <button class="btn">Import</button>
      </div>
      <div class="topbar__spacer"></div>
      <button class="btn btn--run">&#9654; Run</button>
    </header>

    <main class="workspace">
      <aside class="palette" aria-label="Component library">
        <div class="palette__title">Components</div>
        ${PALETTE.map(paletteCategory).join("")}
      </aside>

      <section class="board-area">
        <div class="rail rail--in" aria-label="Input rail">
          <span class="rail__label">Inputs</span>
          <div class="toggle is-off"><span class="toggle__track"><span class="toggle__knob"></span></span><span class="toggle__name">A</span></div>
          <div class="toggle is-on"><span class="toggle__track"><span class="toggle__knob"></span></span><span class="toggle__name">B</span></div>
          <button class="rail__add">+ Add input</button>
        </div>

        <div class="board">
          <div class="empty-state">
            <div class="empty-state__mark">&#9671;</div>
            <div class="empty-state__line">A blank board, ready for a circuit.</div>
            <div class="empty-state__hint">Drag a gate from the left, or add an input to begin.</div>
          </div>
        </div>

        <div class="rail rail--out" aria-label="Output rail">
          <span class="rail__label">Outputs</span>
          <div class="led is-on"><span class="led__lamp"></span><span class="led__name">OUT 0</span></div>
          <div class="led is-off"><span class="led__lamp"></span><span class="led__name">OUT 1</span></div>
          <button class="rail__add">+ Add output</button>
        </div>
      </section>
    </main>

    <footer class="statusbar">
      <span>0 components<span class="dot">&middot;</span>0 wires</span>
      <div class="statusbar__spacer"></div>
      <span>zoom 100%<span class="dot">&middot;</span>not yet saved</span>
    </footer>
  </div>`;
}

const root = document.getElementById("app");
if (!root) throw new Error("Logic Lab: #app root element not found");
root.innerHTML = shell();
