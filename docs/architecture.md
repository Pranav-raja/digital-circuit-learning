# Architecture

The engineering blueprint. Translates the spec's data model (§8), engine (§9),
and structure (§11) into concrete TypeScript contracts we code against. If a
contract here changes, change it in the same commit as the code that breaks it.

## 1. Module map & dependency rule

```
logic-lab/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ src/
   ├─ main.ts                 # bootstraps the app, owns the app store
   ├─ styles/
   │  ├─ tokens.css           # §5 color / type / spacing custom properties
   │  └─ app.css              # layout: topbar, rails, canvas, status bar
   ├─ core/                   # THE BRAIN — pure, no DOM, no imports from ui|canvas
   │  ├─ types.ts             # Circuit, ComponentInstance, Wire, Bit, ...
   │  ├─ registry.ts          # component type definitions + evaluate()
   │  ├─ engine.ts            # evaluate(circuit, registry) → SimResult
   │  ├─ model.ts             # create/mutate/validate circuit data
   │  └─ geometry.ts          # terminal positions, wire Bézier math (pure)
   ├─ canvas/                 # THE BODY — renders core state to SVG
   │  ├─ Canvas.ts            # SVG board, pan/zoom, grid
   │  ├─ Component.ts         # render one component + terminals
   │  ├─ Wire.ts              # Bézier path + signal-flow animation
   │  └─ interactions.ts      # drag-to-wire, move, select, delete (§7)
   ├─ ui/
   │  ├─ Topbar.ts
   │  ├─ Palette.ts
   │  ├─ Rails.ts             # input rail + output rail
   │  └─ StatusBar.ts
   ├─ storage/
   │  ├─ local.ts             # autosave + named saves (§10)
   │  └─ files.ts             # export / import
   └─ store.ts                # app state + change notification (see §5)
```

**The one rule that doesn't bend:** `core/` imports nothing from `canvas/`,
`ui/`, or `storage/`. The arrows point *inward* to `core/`. Enforce with an
ESLint `no-restricted-imports` boundary if cheap.

## 2. Core type contracts (`core/types.ts`)

```ts
/** A logic value. Two states only in v1 — no tri-state/high-Z. */
export type Bit = 0 | 1;

/** Terminal handle within a component, e.g. "in0", "out0". */
export type TerminalId = string;

/** Category keys drive palette grouping (spec §6). */
export type Category =
  | "gates" | "io" | "display" | "arithmetic" | "selectors" | "atoms";

/** A placed component — pure data, part of the save file. */
export interface ComponentInstance {
  id: string;            // unique within the circuit, e.g. "c1"
  type: string;          // key into REGISTRY
  x: number;             // canvas coords, snapped to 24px grid
  y: number;
  label?: string;        // inputs / outputs / displays show this
  value?: Bit;           // ONLY meaningful for input components (toggle state)
  params?: Record<string, number>; // future: bit width for n-bit parts, etc.
}

/** Reference to one terminal of one component. */
export interface TerminalRef {
  comp: string;          // ComponentInstance.id
  term: TerminalId;
}

/** Directed edge: an output terminal → an input terminal. */
export interface Wire {
  id: string;
  from: TerminalRef;     // MUST be an output terminal (validated)
  to: TerminalRef;       // MUST be an input terminal; one wire per input
}

/** A whole circuit. THIS OBJECT IS THE SAVE FILE (spec §8, §10). */
export interface Circuit {
  version: number;       // schema version; bump on breaking change
  name: string;
  updatedAt: string;     // ISO 8601
  components: ComponentInstance[];
  wires: Wire[];
}

export const SCHEMA_VERSION = 1;
```

## 3. Registry contract (`core/registry.ts`)

The registry is the single home of type knowledge. Adding a part is a data entry
here — no new rendering or simulation code for standard gates.

```ts
import type { Bit, Category, TerminalId } from "./types";

/** Values handed to evaluate(): every declared input, defaulted to 0. */
export type Inputs = Record<TerminalId, Bit>;
export type Outputs = Record<TerminalId, Bit>;

/** How the canvas should draw this part. Standard gates use "gate". */
export type RenderKind =
  | "gate" | "toggle" | "led" | "seven-seg" | "transistor" | "block";

export interface ComponentDef {
  label: string;
  category: Category;
  inputs: TerminalId[];   // left face, top→bottom
  outputs: TerminalId[];  // right face, top→bottom
  /** Pure logic. The engine guarantees every input key is present (default 0). */
  evaluate: (inputs: Inputs) => Outputs;
  render?: RenderKind;    // default "gate"
  width?: number;         // default body size if omitted
  height?: number;
}

export type Registry = Record<string, ComponentDef>;

// Example entries (the Phase 1 kit):
export const REGISTRY: Registry = {
  and: {
    label: "AND", category: "gates",
    inputs: ["in0", "in1"], outputs: ["out0"],
    evaluate: (i) => ({ out0: (i.in0 & i.in1) as Bit }),
  },
  or: {
    label: "OR", category: "gates",
    inputs: ["in0", "in1"], outputs: ["out0"],
    evaluate: (i) => ({ out0: (i.in0 | i.in1) as Bit }),
  },
  not: {
    label: "NOT", category: "gates",
    inputs: ["in0"], outputs: ["out0"],
    evaluate: (i) => ({ out0: i.in0 ? 0 : 1 }),
  },
  input: {
    label: "IN", category: "io", render: "toggle",
    inputs: [], outputs: ["out0"],
    // value lives on the instance; engine special-cases inputs (see §4).
    evaluate: () => ({ out0: 0 }),
  },
  output: {
    label: "OUT", category: "io", render: "led",
    inputs: ["in0"], outputs: [],
    evaluate: () => ({}),
  },
};
```

**Input components are special** — their output is the instance's `value`, not a
function of inputs. The engine reads `value` directly (see §4). Keeping a no-op
`evaluate` lets the rest of the code treat them uniformly.

## 4. Simulation engine (`core/engine.ts`)

Pure, deterministic, DOM-free. The whole v1 simulation is one topological pass.

```ts
export interface SimResult {
  /** Per component: its output terminal values. */
  outputs: Map<string, Outputs>;
  /** Per wire id: the value flowing through it (its source output value). */
  wireValues: Map<string, Bit>;
  /** Diagnostics for the UI to surface (spec §9 cycle handling). */
  errors: { cycleWireIds: string[] };
}

export function evaluate(circuit: Circuit, registry: Registry): SimResult;
```

**Algorithm**

1. **Index.** Build `id → ComponentInstance`. For each input terminal of each
   component, record the single feeding wire (last write wins; the model layer
   already enforces one-wire-per-input).
2. **Topological sort (Kahn's).** Edge = wire's source comp → target comp.
   In-degree counts distinct upstream components. Inputs and unconnected parts
   start at in-degree 0.
3. **Cycle detection.** If the sort can't place every node, the remainder forms
   one or more cycles. Collect the wires among unresolved nodes into
   `errors.cycleWireIds`. Evaluate the acyclic portion normally; cyclic nodes get
   `0` outputs. **Never loop forever.**
4. **Evaluate in order.** For each component:
   - If it's an input type → `outputs[id] = { out0: instance.value ?? 0 }`.
   - Else gather inputs: for each declared input terminal, read the value at the
     feeding wire's source (default `0` if unconnected), then call
     `def.evaluate(inputs)`.
5. **Wire values.** For each wire, `wireValues[w.id] = outputs[from.comp][from.term]`.

Re-run the whole pass on any change (toggle, wire add/remove, delete). At v1
sizes this is instant; no incremental dirty-tracking. (Stretch, spec §9:
iterative settling for sequential logic — evaluate repeatedly until stable or a
step cap — added behind the same `evaluate` signature.)

## 5. State & change flow (`store.ts`)

A tiny observable store, no framework. One source of truth, one re-render path.

```ts
type Listener = () => void;

interface AppState {
  circuit: Circuit;
  selection: Set<string>;     // selected component/wire ids
  view: { panX: number; panY: number; zoom: number };
  sim: SimResult;             // recomputed on circuit change
  savedAt: number | null;     // autosave heartbeat for the status bar
}
```

The loop: **mutate `circuit` via `model.ts` → recompute `sim` via `engine.ts` →
notify listeners → `canvas`/`ui`/`storage` react.** Persistence subscribes and
debounces; the canvas subscribes and repaints. Nothing mutates `circuit`
directly except through `model.ts` helpers (so validation and id-generation stay
in one place).

## 6. Geometry (`core/geometry.ts`)

Pure math, no DOM — testable and shared by canvas + interactions.

- **Terminal positions:** inputs evenly spaced on the left face, outputs on the
  right face, derived from the component box + the registry's pin lists.
- **Wire path (spec §7):** cubic Bézier from output `P0=(x0,y0)` to input
  `P3=(x3,y3)` with `k = clamp(|x3-x0| * 0.5, 40, 160)`, control points
  `P1=(x0+k,y0)`, `P2=(x3-k,y3)`. The smooth left→right "S".
- **Grid snap:** round to the 24px canvas grid.

## 7. Persistence contracts (`storage/`)

- `local.ts`: `autosave(circuit)` debounced ~800ms → `logiclab:current`;
  `listSaved()/save(name)/load(id)/remove(id)` over `logiclab:saved:<id>`.
  Guards the ~5MB ceiling with a graceful message.
- `files.ts`: `exportCircuit(circuit)` → Blob download `<name>.json`;
  `importCircuit(file)` → validate (`version`, shape) → `Circuit` or a typed
  error. Drag-`.json`-onto-canvas is a thin wrapper over `importCircuit`.

Validation lives in `core/model.ts` (`validateCircuit(unknown): Result`) so both
file import and any future paste path share one gate.

## 8. Testing strategy

- **Engine (must-have, spec §13):** truth-table unit tests with Vitest — AND, OR,
  NOT, fan-out, unconnected-input defaults, and a half-adder built from
  primitives. Plus a cycle test asserting it flags and returns rather than hangs.
- **Geometry:** Bézier control-point and grid-snap assertions (pure, trivial).
- **Model/validation:** round-trip `Circuit → JSON → Circuit`; reject malformed
  and wrong-`version` files.
- Canvas/UI are not unit-tested in v1 (manual + the runnable per-phase checkpoint
  is the gate). Keep logic out of the DOM layer so this stays true.

## 9. Conventions

- TypeScript `strict: true`. No `any` in `core/`.
- IDs: short prefixed strings (`c1`, `w1`) from a monotonic counter in `model.ts`.
- Coordinates are canvas-space (pre-zoom); the canvas applies pan/zoom as an SVG
  transform so `core/` never sees screen pixels.
- ESLint + Prettier; format on commit.
