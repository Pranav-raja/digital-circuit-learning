# ◇ Logic Lab

> A browser-based logic-circuit simulator for learning how computers think — at the AND/OR/NOT layer where computer architecture begins.

Place gates, wire them up, flip the inputs, and **watch the signal light up the wires**. No backend, no accounts, no setup — your work lives in the browser and travels as a single `.json` file. The whole point is the tactile loop: change an input → the change ripples through the wires → an output reacts. Logic Lab makes an invisible idea — signal propagation — visible.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/built%20with-Vite-646CFF?logo=vite&logoColor=white)
![SVG](https://img.shields.io/badge/render-inline%20SVG-FF9A3C)
![No backend](https://img.shields.io/badge/backend-none-555)

---

## ✨ Highlights

- **The signal is the star.** A wire carrying logic-1 glows warm amber and a faint pulse travels along it, left to right; a logic-0 wire is a dim slate line. You can literally see propagation happen.
- **No mode confusion.** What you do is decided by *where* you click — drag from a terminal to wire, drag a body to move, click an input to toggle. There's no "wiring mode" to get stuck in.
- **Forgiving by default.** Everything autosaves; every action is undoable.
- **Learn while you build.** An in-app **Component Guide** (truth tables + real-world uses) and an interactive **first-run tutorial** that follows along as you build your first AND gate.

## 🧩 What's in the box

| Category | Parts |
|---|---|
| **Gates** | AND, OR, NOT, NAND, NOR, XOR, XNOR |
| **I/O** | Input toggles, output LEDs, **clock** |
| **Display** | 7-segment hex display (4-bit) |
| **Arithmetic** | Half adder, full adder |
| **Selectors** | 2:1 MUX, 4:1 MUX |
| **Sequential** | D flip-flop (real edge-triggered memory) |
| **Your own** | **Reusable blocks** — group any selection into a single part |

- **Sequential logic** runs on an iterative-settling engine, so feedback loops work: wire a flip-flop's `Q'` back to `D`, add a clock, and watch it divide the clock by two.
- **Subcircuits / blocks** — select part of a circuit, **Group** it (`Ctrl/⌘+G`), and it collapses into one reusable block (with auto-created pins for every wire that crossed the boundary). Blocks live in a **My Blocks** palette to drop again, and nest inside each other.
- **Persistence** — autosave to `localStorage`, named "My Circuits" saves, and **Export / Import** as portable `.json` (drag a file onto the board to load it).
- **Comfortable to drive** — pan/zoom, fit-to-content, a light/dark theme, full keyboard shortcuts, and trackpad/touch gestures (pinch-zoom, two-finger pan).

## 🖥️ The workspace

```
┌───────────────────────────────────────────────────────────────────────┐
│  ◇ Logic Lab   [New] [Save] [Open ▾] [Export] [Import] [Group]   ● Live │
├──────────┬──────────────────────────────────────────────┬─────────────┤
│ PALETTE  │  ░░░░░░░░░░░░░ BLUEPRINT GRID ░░░░░░░░░░░░░░░ │  OUTPUT     │
│ My Blocks│  ◉ A ─────────┐                               │  RAIL       │
│ ▸ Gates  │               ├─[ AND ]──────────────────────●│  ● OUT 0    │
│ ▸ I/O    │  ◉ B ─────────┘                               │  ○ OUT 1    │
│ ▸ Arith. │            the center build area (pan + zoom)  │             │
├──────────┴──────────────────────────────────────────────┴─────────────┤
│  3 components · 2 wires                  Fit  − 100% +  ·  saved 4s ago  │
└───────────────────────────────────────────────────────────────────────┘
```

## 🚀 Getting started

Requires **Node 20+**.

```bash
npm install      # install dependencies
npm run dev      # start the dev server → http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm run test       # run the engine/model unit tests (Vitest)
npm run lint       # ESLint
npm run format     # Prettier
```

## 🎮 Controls

| Action | How |
|---|---|
| Place a part | Click it in the palette (gates drop at center; I/O via **+ Add**) |
| Draw a wire | Drag from an **output** terminal to an **input** terminal |
| Move a gate | Drag its body — connected wires follow |
| Toggle an input | Click it |
| Select / multi-select | Click · **Shift-click** to add · `Ctrl/⌘+A` for all |
| Delete | `Delete` / `Backspace` |
| Group into a block | `Ctrl/⌘+G` (or the **Group** button) |
| Undo / redo | `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z` |
| Save | `Ctrl/⌘+S` (autosaves anyway) |
| Pan | Drag empty canvas · two-finger scroll · space-drag · middle-mouse |
| Zoom | Pinch · `Ctrl/⌘+scroll` · the **− / +** buttons |
| Cancel a wire | `Esc` |

## 🛠️ Tech & architecture

**Vite + TypeScript (strict) + hand-rolled inline SVG.** No UI framework — hand-written CSS with custom properties keeps the bundle tiny and the code readable, which matters for a project meant for *learning*.

The core idea is a clean split:

- **`src/core/`** — the brain: a static component **registry**, a **pure simulation engine** (`evaluate(circuit) → result`, no DOM), the circuit **model**, and **geometry**. It's unit-tested and imports nothing from the UI.
- **`src/canvas/`**, **`src/ui/`**, **`src/storage/`** — the body: SVG rendering, interactions, panels, and persistence. These may use `core/`; `core/` never uses them.

```
src/
├─ core/      types · registry · engine · model · geometry  (pure, tested)
├─ canvas/    Canvas (SVG render) · interactions (pointer/touch)
├─ ui/        Palette · Topbar · StatusBar · Guide · Tutorial · Blocks · Theme
├─ storage/   local (autosave + named saves) · files (export/import)
└─ store.ts   observable state: mutate → re-simulate → notify
```

Deeper docs live in [`docs/`](docs/):

- [Build & UX spec](docs/logic-lab-build-spec.md) — the product blueprint
- [Architecture](docs/architecture.md) — module contracts and the engine
- [Decisions (ADRs)](docs/decisions.md) — why things are the way they are
- [Roadmap](docs/roadmap.md) — phase-by-phase build log

## ✅ Status

All six build phases are complete: a working simulator, autosave/undo, files & named saves, the full visual polish, the rich component catalog, **plus** the stretch goals — a sequential engine with clock & flip-flops, reusable subcircuit blocks, an interactive tutorial, and trackpad/touch support. The pure engine is covered by **25 unit tests** (truth tables, the half-adder, MUX/adder, flip-flop edge-capture, oscillation handling, and grouped-block evaluation).

---

*A learning project — built to be understood as much as used.*
