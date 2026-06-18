# Logic Lab — Build & UX Specification

A browser-based logic circuit simulator for students learning computer architecture. Place gates, wire them up, flip inputs, and watch signals light up the outputs. No backend, no accounts — work lives in the browser and travels as a file.

This document is the blueprint. Work through it top to bottom; each section is something you can build and tick off.

---

## 1. What we're building (and for whom)

**Subject:** digital logic — the AND/OR/NOT layer where computer architecture actually begins.

**Audience:** students (high school → early university) and self-learners who've read about gates but never *touched* one. The whole point is the tactile loop: change an input → the change ripples through wires → an output reacts. The simulator makes an invisible idea (signal propagation) visible.

**The one job of the page:** let someone go from a blank canvas to a working circuit in under a minute, with zero setup friction.

**Hard scope for v1:**
- AND, OR, NOT gates as the core kit.
- A workspace split into three zones: input rail (left), build area (center), output rail (right).
- Toggle inputs, draw wires, real-time simulation.
- Save / load via localStorage; download / upload as a `.json` file.
- A browsable component palette including the richer elements (MUX, adder, subtractor, 7-segment display, transistor, etc.) — wired in progressively, not all at once.

**Explicitly out of scope for v1:** server, login, multiplayer, mobile-first touch editing (desktop-first; mobile is a stretch goal).

---

## 2. Design philosophy (the UX guardrails)

Five rules to judge every decision against:

1. **The signal is the star.** A wire carrying logic-1 should look unmistakably *alive* compared to a wire at logic-0. This is the single most important visual job of the whole app.
2. **Left to right is truth.** Inputs on the left, signal flows right, outputs on the right — the same way logic is drawn on a whiteboard. The three-zone layout isn't decoration; it teaches direction of flow.
3. **No mode confusion.** A student should never wonder "am I in wiring mode or moving mode?" Interactions are driven by *where* you click (a terminal vs. a body), not by a toolbar mode toggle.
4. **Forgiving by default.** Every destructive action (delete, clear) is undoable. Saving is automatic; losing work should be nearly impossible.
5. **Quiet chrome, loud canvas.** Toolbar and panels stay calm and neutral. The canvas — where learning happens — gets all the color and motion.

---

## 3. Tech stack

**Primary recommendation: Vite + Vanilla JS (or TypeScript) + inline SVG for the canvas.**

Reasoning:
- **No framework lock-in, no backend, instant dev server.** `npm create vite@latest` and you're coding in seconds — matches the "hassle-free" brief.
- **SVG is perfect for this.** Components and wires are vector shapes with crisp terminals; wires are Bézier `<path>` elements you can animate with pure CSS. Hit-testing (clicking a terminal) is just DOM events on `<circle>` elements — no manual pixel math like Canvas would need.
- **Educational honesty.** You'll understand your own wire geometry and simulation loop instead of hiding it inside a library. Good for a learning project, and good for *teaching* with it.
- **TypeScript optional but recommended** once the data model grows — it catches "this terminal has no component" bugs early.

**Faster alternative (if you'd rather not hand-roll the node editor):** React + Vite + **React Flow**. React Flow gives you draggable nodes, connectable handles, and wire rendering for free. Trade-off: you inherit its data model and styling constraints, and the three-zone layout takes a little wrangling. Pick this only if you want the editor working *this week* and don't mind a heavier dependency.

**Recommended supporting tools:** Vite (build/dev), ESLint + Prettier (tidy code), and **no UI framework** — hand-written CSS with custom properties is plenty and keeps the bundle tiny.

For the rest of this spec I assume the **Vite + Vanilla + SVG** path.

---

## 4. Layout & information architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│  TOPBAR:  ◇ Logic Lab    [New] [Save] [Open ▾] [Export] [Import]   ▶ Sim │
├──────────┬──────────────────────────────────────────────┬─────────────┤
│          │  ░░░░░░░░░░░░░░░░░ BLUEPRINT GRID ░░░░░░░░░░░░ │             │
│ PALETTE  │  ┌──────┐                                     │  OUTPUT     │
│ (drawer) │  │INPUT │                                     │  RAIL       │
│          │  │ rail │      ┌─────┐                        │             │
│ ▸ Gates  │  │ ◉ A  │──────┤ AND ├────────────────────────│  ● OUT 0    │
│ ▸ I/O    │  │ ◉ B  │──────┤     │                        │  ○ OUT 1    │
│ ▸ Display│  └──────┘      └─────┘                        │             │
│ ▸ Arith. │        the CENTER BUILD AREA (pan + zoom)      │             │
│ ▸ Atoms  │                                               │             │
├──────────┴──────────────────────────────────────────────┴─────────────┤
│  STATUS BAR:  3 components · 2 wires · zoom 100% · saved 12s ago         │
└───────────────────────────────────────────────────────────────────────┘
```

Five regions:

- **Topbar** — brand, file actions, and the simulation run/pause control. Everything global lives here. Keep it to one row.
- **Palette (left drawer)** — the *library* the user browses. Collapsible categories (see §6). Distinct from the input rail — the palette is "the parts bin," the input rail is "where signals start." Drag a part from here onto the canvas, or click to drop at center.
- **Input rail (left edge of canvas)** — a docked column of toggle inputs. Click a toggle to flip it 0↔1. New inputs are created here (a "+ Add input" affordance at the bottom).
- **Center build area** — the main canvas. Pan (space-drag or middle-mouse) and zoom (scroll). Holds gates and complex components, plus all wires.
- **Output rail (right edge of canvas)** — docked column of output LEDs / displays. Their input terminals accept wires; they show the result.
- **Status bar** — quiet telemetry: component/wire counts, zoom level, and the autosave heartbeat ("saved 12s ago"). This is how rule #4 (forgiving) becomes *visible*.

> **UX note on the input/output rails:** dock them as fixed columns that stay put while the center pans. That preserves the "inputs are always on the left, outputs always on the right" mental model even on a big circuit. The rails are part of the canvas conceptually, but visually pinned.

---

## 5. Visual design system

A deliberate identity so this doesn't read as a default template. The direction: **a modern lab instrument laid over an engineer's blueprint.** Cool, technical, calm — until a signal turns on, and then it *glows*.

### Color (4–6 named tokens)

| Token | Hex | Role |
|---|---|---|
| `--bg-board` | `#0E1726` | deep blueprint indigo — the canvas background |
| `--bg-chrome` | `#111C2E` | slightly lifted panels, topbar, rails |
| `--ink` | `#C7D2E0` | primary text / component outlines |
| `--signal-high` | `#FFB454` | **logic 1** — warm amber, evokes a glowing filament / LED |
| `--signal-low` | `#3A4A63` | **logic 0** — dim cool slate, clearly "off" |
| `--accent` | `#22D3EE` | electric cyan — selection, focus rings, hover, active UI |

The key pairing is **amber signal on indigo board** — a strong warm/cool complement that makes HIGH wires pop without resorting to the overused acid-green-on-black look. Cyan is reserved strictly for *interaction* feedback so users learn "cyan = me, amber = the circuit."

Provide a **light theme** too (board → soft paper `#F2F4F8`, signal-high stays amber, signal-low → `#9AA7BD`) and respect `prefers-color-scheme`. Dark is the default.

### Typography (3 roles)

- **Display / UI headings:** `Space Grotesk` — geometric with a technical quirk, distinctive without being loud.
- **Body / labels:** `Inter` — neutral, legible at small sizes.
- **Data readouts:** `JetBrains Mono` — every logic value, pin label, and 7-segment number is monospace. This encodes something true: these are *measurements*, not prose.

Type scale (rem): `0.75 / 0.875 / 1 / 1.25 / 1.5 / 2`. Generous letter-spacing on the small mono labels (`0.04em`).

### Spacing & shape

- 8px base grid for chrome; **24px grid for the canvas** (components snap to it).
- Border radius: `6px` on panels/buttons, but **gates have sharp corners** — schematic symbols are angular, and the contrast between rounded chrome and angular parts reinforces "the UI is software, the parts are circuits."
- Hairline `1px` borders in `--signal-low` to separate panels.

### The signature element: living signal flow

When a wire carries logic-1, animate a **faint traveling pulse** along its path (a CSS `stroke-dashoffset` animation on a second overlaid stroke, or an animated gradient). Slow, ~2s loop, low opacity so it never gets noisy. A wire at logic-0 is a flat dim slate line. This is the moment that makes propagation *legible* — students literally watch the signal move left to right. Respect `prefers-reduced-motion` by falling back to a static glow.

Component state changes (LED on, toggle flip) animate with a quick `120ms` ease so feedback feels instant but not jarring.

---

## 6. Component library (the catalog)

Organize the palette into these categories. Build them in roughly this order — the first two categories make a complete, useful app on their own.

**Gates** (build first)
| Part | Inputs | Outputs | Logic |
|---|---|---|---|
| AND | 2 | 1 | out = a & b |
| OR | 2 | 1 | out = a \| b |
| NOT | 1 | 1 | out = !a |
| NAND | 2 | 1 | !(a & b) *(stretch)* |
| NOR | 2 | 1 | !(a \| b) *(stretch)* |
| XOR | 2 | 1 | a ^ b *(stretch)* |
| XNOR | 2 | 1 | !(a ^ b) *(stretch)* |

**I/O** (build first)
| Part | Notes |
|---|---|
| Input toggle | lives on the left rail; click toggles 0↔1 |
| Output LED | lives on the right rail; glows amber on 1 |
| Clock | auto-toggles at an interval *(stretch — needs the sequential engine)* |

**Display**
| Part | Inputs | Notes |
|---|---|---|
| 7-segment display | 4 (BCD) | shows a single hex/decimal digit |
| Multi-digit number display | n×4 | chain BCD inputs into a readout |

**Arithmetic**
| Part | Inputs | Outputs | Notes |
|---|---|---|---|
| Half adder | 2 | 2 (sum, carry) | the teaching primitive |
| Full adder | 3 | 2 (sum, carry) | a + b + carry-in |
| n-bit adder | 2n+1 | n+1 | ripple-carry chain |
| n-bit subtractor | 2n | n+1 | two's-complement |

**Selectors / data**
| Part | Inputs | Outputs | Notes |
|---|---|---|---|
| 2:1 MUX | 2 + 1 select | 1 | |
| 4:1 MUX | 4 + 2 select | 1 | |
| Demux / decoder | varies | varies | *(stretch)* |

**Atoms** (advanced / educational)
| Part | Notes |
|---|---|
| Transistor (NMOS / PMOS) | shows how a gate is built from switches — pairs beautifully with the "build an AND gate from transistors" lesson |

Each component is defined by a small **descriptor** (see §8) so adding a new part is data, not new rendering code. Standardize terminal positions: inputs on the left face, outputs on the right face, evenly spaced. This keeps wiring predictable and the left→right flow honest.

---

## 7. Core interactions (the heart of the UX)

Interactions are driven by **what you click**, not a global mode. This is rule #3 made concrete.

**Placing a component**
- Drag from the palette onto the canvas, *or* click a palette item to drop it at the viewport center. It snaps to the 24px grid.
- A new input toggle appears on the left rail; a new output LED on the right rail.

**Drawing a wire**
- Press on an **output terminal** → a wire starts and follows the cursor as a live Bézier preview.
- Release on a compatible **input terminal** → the wire commits.
- Release on empty space → the wire is discarded.
- Rule: outputs connect to inputs only; an input terminal accepts **one** wire (last one wins, or reject with a soft shake); an output can fan out to **many** inputs.
- Terminals **highlight cyan on hover** during a drag so valid targets are obvious.

**Moving**
- Press on a component **body** (not a terminal) → drag to move. Connected wires follow live.
- Marquee-select (drag on empty canvas) → move a group.

**Toggling an input**
- Single click an input toggle flips its value. The whole downstream circuit re-evaluates immediately (see §9).

**Selecting / deleting**
- Click selects (cyan outline). `Delete`/`Backspace` removes the selection and any attached wires.
- Click a wire to select just that wire.

**Canvas navigation**
- Scroll = zoom (toward cursor). Space-drag or middle-mouse = pan. A "fit to content" button in the status bar reframes everything.

**Wire geometry (the one bit of math):** draw each wire as a cubic Bézier from output point `P0` to input point `P3`. Set control points horizontally offset by `k = clamp(|x3 - x0| * 0.5, 40, 160)`:
```
P1 = (x0 + k, y0)
P2 = (x3 - k, y3)
```
This gives the smooth left-to-right "S" that reads as a circuit trace and never overlaps the component bodies awkwardly.

**Essential keyboard shortcuts:** `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+S` save, `Delete` remove, `Ctrl/Cmd+A` select all, `Esc` cancel a wire-in-progress.

---

## 8. Data model

One plain object describes a whole circuit. This *is* the save file.

```json
{
  "version": 1,
  "name": "Half adder demo",
  "updatedAt": "2026-06-17T10:30:00.000Z",
  "components": [
    { "id": "c1", "type": "input",  "x": 0,   "y": 120, "value": 0, "label": "A" },
    { "id": "c2", "type": "input",  "x": 0,   "y": 200, "value": 1, "label": "B" },
    { "id": "c3", "type": "and",    "x": 360, "y": 140 },
    { "id": "c4", "type": "xor",    "x": 360, "y": 260 },
    { "id": "c5", "type": "output", "x": 720, "y": 160, "label": "CARRY" },
    { "id": "c6", "type": "output", "x": 720, "y": 280, "label": "SUM" }
  ],
  "wires": [
    { "id": "w1", "from": { "comp": "c1", "term": "out0" }, "to": { "comp": "c3", "term": "in0" } },
    { "id": "w2", "from": { "comp": "c2", "term": "out0" }, "to": { "comp": "c3", "term": "in1" } }
  ]
}
```

Alongside, keep a static **component-type registry** (not saved — it's code) that defines each type's shape and behavior:

```js
const REGISTRY = {
  and: {
    label: "AND",
    inputs:  ["in0", "in1"],
    outputs: ["out0"],
    evaluate: (inputs) => ({ out0: inputs.in0 & inputs.in1 }),
  },
  not: {
    label: "NOT",
    inputs:  ["in0"],
    outputs: ["out0"],
    evaluate: (inputs) => ({ out0: inputs.in0 ? 0 : 1 }),
  },
  // ...one entry per part. Adding a gate = adding an object here.
};
```

This separation — **mutable circuit data** vs. **static type registry** — is the most important architectural decision in the project. New parts become data entries; rendering and simulation stay generic.

---

## 9. Simulation engine

The circuit is a directed graph: components are nodes, wires are edges. For combinational logic (everything in v1), evaluation is a clean topological pass.

1. **Build the graph** from `components` + `wires`.
2. **Topologically sort** the nodes (inputs have no dependencies, so they come first).
3. **Evaluate in order:** for each component, gather its input values (an unconnected input defaults to `0`), run its `evaluate()` from the registry, store its output values.
4. **Render:** color each wire by the value at its source output; light each LED / update each display by the value at its input.

Re-run this pass whenever the circuit changes — a toggle flips, a wire is added/removed, a component is deleted. For circuits this size it's instant; no need for incremental dirty-tracking in v1.

**Cycle handling:** pure combinational circuits have no cycles, so a cycle means either an error or a sequential element (flip-flop). For v1, detect cycles during the topo sort and flag the offending wires (cyan→red), rather than hang. *(Stretch: support sequential logic by switching to iterative settling — evaluate repeatedly until values stop changing or a step cap is hit — which is what enables clocks and flip-flops.)*

Keep the engine **pure**: `evaluate(circuit) → { wireValues, componentOutputs }`. No DOM inside it. The renderer reads its result. This makes it trivial to unit-test ("AND of 1 and 0 is 0") and keeps simulation independent of how things look.

---

## 10. Persistence (localStorage + files)

**Autosave** — debounce ~800ms after any change, write the current circuit JSON to `localStorage` under a key like `logiclab:current`. The status bar shows the heartbeat. This is rule #4: work is never more than a second from saved.

**Named saves** — a "My Circuits" list, also in localStorage (`logiclab:saved:<id>`), reachable from the `Open ▾` menu. Each entry stores the JSON plus name and timestamp. Watch the ~5MB localStorage ceiling; these files are tiny, but show a graceful message if it's ever hit.

**Export** — serialize the circuit and trigger a download of `circuit-name.json` via a `Blob` + temporary `<a download>`. This is the user's portable, shareable, backup-able artifact.

**Import** — a file picker (and ideally drag-a-`.json`-onto-the-canvas). Validate `version` and shape before loading; on mismatch, show a clear message ("This file was made with a newer version of Logic Lab") rather than crashing.

Because the save file and the in-memory model are the *same shape* (§8), export/import is essentially `JSON.stringify` / `JSON.parse` plus validation. No translation layer.

---

## 11. Project structure

```
logic-lab/
├─ index.html
├─ package.json
├─ vite.config.js
└─ src/
   ├─ main.js                 # bootstraps the app
   ├─ styles/
   │  ├─ tokens.css           # the §5 color/type/space variables
   │  └─ app.css              # layout: topbar, rails, canvas, status bar
   ├─ core/
   │  ├─ registry.js          # component type definitions (§8)
   │  ├─ engine.js            # pure simulation (§9) — no DOM
   │  └─ model.js             # create/mutate circuit data, validation
   ├─ canvas/
   │  ├─ Canvas.js            # SVG board, pan/zoom, grid
   │  ├─ Component.js         # render one component + its terminals
   │  ├─ Wire.js              # Bézier path + signal-flow animation
   │  └─ interactions.js      # drag-to-wire, move, select, delete (§7)
   ├─ ui/
   │  ├─ Topbar.js
   │  ├─ Palette.js           # browsable component library (§6)
   │  ├─ Rails.js             # input rail + output rail
   │  └─ StatusBar.js
   └─ storage/
      ├─ local.js             # autosave + named saves (§10)
      └─ files.js             # export / import
```

The dependency rule: `ui/` and `canvas/` may import from `core/`, but **`core/` imports nothing from them.** Keep the brain (engine) clean of the body (DOM).

---

## 12. Build roadmap

Ship something runnable at the end of every phase.

**Phase 0 — Scaffold.** Vite project, the three-zone layout in static CSS, the design tokens from §5. Empty but on-brand.

**Phase 1 — A circuit that works.** Registry with AND/OR/NOT + input/output. Place from palette, drag-to-wire, toggle inputs, run the engine, light the LEDs. This is the milestone where the app becomes *real* — prioritize it.

**Phase 2 — Don't-lose-my-work.** Autosave to localStorage on a debounce; reload restores it. Undo/redo. Status-bar heartbeat.

**Phase 3 — Files & saves.** Export/import `.json`; named "My Circuits" list.

**Phase 4 — Polish the feel.** Signal-flow animation on live wires, hover/selection states, pan/zoom, fit-to-content, keyboard shortcuts, light theme.

**Phase 5 — Richer parts.** XOR/NAND/NOR, MUX, half/full adder, 7-segment display. Each is just a registry entry plus (for the display) a custom renderer.

**Phase 6 — Stretch.** Sequential engine (iterative settling) → clock + flip-flops; transistor "build-a-gate" mode; subcircuits (collapse a circuit into a reusable block); a guided lesson/tutorial overlay; touch support.

---

## 13. Quality floor (don't skip these)

- **Keyboard accessible:** visible focus rings (cyan), Tab through palette and toolbar, shortcuts in §7.
- **Reduced motion:** static glow instead of the traveling pulse when `prefers-reduced-motion` is set.
- **Empty state as a guide:** the blank canvas shows a one-line invitation — "Drag a gate from the left, or add an input to begin" — not a void.
- **Errors speak plainly:** "This input already has a wire," "That file looks corrupted" — in the interface's voice, never a stack trace.
- **Unit-test the engine:** a handful of truth-table tests (AND, OR, NOT, half-adder) guard the one part where a bug is silent and confusing.

---

## 14. Naming

Working title **Logic Lab** throughout. If you want alternatives in the same spirit: *Gatework*, *Trace*, *Pinout*, *Spark*. Pick one early so the brand token in the topbar and the export filename prefix stay consistent.
