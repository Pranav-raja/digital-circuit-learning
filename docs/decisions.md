# Decision Log (ADRs)

Architecture Decision Records. Each entry closes a fork so we don't relitigate
it. Append new ones; don't rewrite history — supersede instead.

Format: **Context** (the forcing question) → **Decision** → **Consequences**
(what we accept by choosing this).

---

## ADR-001 — Stack: Vite + TypeScript + hand-rolled SVG
**Status:** Accepted · 2026-06-18

**Context.** The spec (§3) recommends Vite + vanilla/TS + inline SVG as primary,
with React + React Flow as a faster alternative, and calls TypeScript "optional
but recommended." We need one path before writing the architecture.

**Decision.** Vite + **TypeScript** + hand-rolled **inline SVG**. No UI
framework; hand-written CSS with custom properties.

**Consequences.**
- We own the node editor: wire geometry, hit-testing, pan/zoom. More code than
  React Flow, but full control over the three-zone layout and signal-flow
  styling — and educational transparency (spec's stated value).
- TypeScript pays off precisely where this project is hardest: the component
  registry and the engine. Compile-time guarantees that a wire references a real
  terminal, that `evaluate` returns the declared outputs.
- Cost: a `tsconfig`, build step, and type ceremony. Accepted — the data model
  is the heart, and we want it typed.
- Rejected React Flow: inheriting its data model fights the spec's own data
  model (§8) and the docked-rail layout.

---

## ADR-002 — Name: Logic Lab
**Status:** Accepted · 2026-06-18

**Context.** Spec §14 asks to pick a name early so the brand token and export
filename prefix stay consistent. Candidates: Logic Lab, Gatework, Trace, Pinout,
Spark.

**Decision.** **Logic Lab.**

**Consequences.** Brand token in the topbar reads "◇ Logic Lab". Storage keys
are namespaced `logiclab:*` (e.g. `logiclab:current`, `logiclab:saved:<id>`).
Export filenames derive from the circuit name, no app prefix needed.

---

## ADR-003 — Two-layer model: mutable circuit data vs. static type registry
**Status:** Accepted · 2026-06-18 · _restates spec §8 as a binding rule_

**Context.** How do we add a new part — a code change, or data?

**Decision.** A whole circuit is one plain serializable object (`Circuit`) — and
that object *is* the save file. Separately, a static `REGISTRY` (code, never
saved) defines each type's shape and `evaluate` behavior.

**Consequences.**
- Adding a gate = adding one `REGISTRY` entry. Rendering and simulation stay
  generic — they read the registry, never hardcode a type.
- Save/load is `JSON.stringify`/`parse` + validation. No translation layer
  because the in-memory model and the file are the same shape.
- The registry is the single place type knowledge lives; everything else is
  data-driven.

---

## ADR-004 — The engine is pure: no DOM inside `core/`
**Status:** Accepted · 2026-06-18 · _restates spec §9/§11 as a binding rule_

**Context.** Where does simulation live relative to rendering?

**Decision.** `evaluate(circuit, registry) → SimResult` is a pure function. No
DOM, no side effects. `ui/` and `canvas/` may import `core/`; **`core/` imports
nothing from them.**

**Consequences.**
- The engine is unit-testable in isolation (truth tables), the one place a bug
  is silent and confusing.
- The renderer is a consumer of `SimResult`, not a participant in simulation.
- Enforced as a lint boundary if practical (no `core/ → ui|canvas` imports).

---

## ADR-005 — v1 is combinational only; cycles are flagged, never hung
**Status:** Accepted · 2026-06-18

**Context.** A feedback loop (flip-flop) creates a graph cycle. A naive topo
pass would hang or crash.

**Decision.** v1 supports combinational logic only. The engine detects cycles
during the topological sort and flags the offending wires (cyan → red) with a
plain-language message. It never hangs.

**Consequences.**
- Clocks, flip-flops, and anything sequential are explicitly Phase 6 (stretch),
  gated behind an iterative-settling engine. The current engine's contract
  reserves an `errors.cycleWireIds` field so the UI can surface cycles today.

---

## ADR-006 — Persistence: localStorage + portable JSON, identical shape
**Status:** Accepted · 2026-06-18 · _restates spec §10_

**Decision.** Autosave (debounced ~800ms) to `localStorage` under
`logiclab:current`. Named saves under `logiclab:saved:<id>`. Export/import is the
same `Circuit` JSON via Blob download / file picker, validated on the way in.

**Consequences.** One canonical shape end to end. Import validates `version` and
structure and fails with a human message, never a stack trace.

---

## ADR-009 — Sequential engine via iterative settling
**Status:** Accepted · 2026-06-20 · _Phase 6; supersedes the topo-pass in ADR-005_

**Context.** Flip-flops and clocks need feedback loops, which the original
topological pass treated as errors. The spec's stretch path: iterative settling.

**Decision.** `evaluate` now settles combinational parts (Gauss-Seidel, capped at
80 iters) with sources and sequential outputs held fixed, then sequential parts
**commit** their state from the settled inputs (edge detection), then settle once
more. State is threaded in/out (`prevState` → `SimResult.state`) so the function
stays pure; the store holds it and resets it on undo/redo/load. Clocks are
`source` parts flipped by a 700ms timer via a **silent** `tickClock()` (no
undo entry, no autosave churn — clock phase is transient, not a user edit).

**Consequences.**
- A 2-NOT loop is now a stable bistable latch, not an error; only loops that never
  settle (odd-inversion oscillators) are flagged. Cycle detection = "didn't settle."
- **Self-wires are now allowed** (model no longer rejects `from.comp === to.comp`)
  so a flip-flop's Q' → D divide-by-two works; bad combinational self-loops just
  oscillate → flagged.
- Sequential state is NOT persisted (clock phase / Q reset on reload) — acceptable
  for v1; the circuit topology is what's saved.
- New parts: `clock` (custom square-wave renderer) and `dff` (D flip-flop, default
  gate renderer) — a new `sequential` category.

---

## ADR-008 — In-app Component Guide (the manual)
**Status:** Accepted · 2026-06-20 · _feature beyond the spec, user-requested_

**Context.** Users need to learn what each part does, how it works, and where it's
used. Options: per-part info icons, per-category icons, or one global help panel.

**Decision.** Both contextual and browsable entry points, opening one slide-in
drawer: a **ⓘ icon on every live palette part** (contextual) plus a **"Guide"
button** in the palette header (browse all). Teaching content lives in
`ui/guide-content.ts` — data keyed by component type, kept SEPARATE from
`core/registry.ts` (registry = logic/shape; guide = prose). Any `[data-guide]`
element opens the drawer via one delegated listener (`ui/Guide.ts`).

**Consequences.**
- Adding a part's help is a data entry in `guide-content.ts`; no wiring.
- The drawer is off-canvas chrome (rule #5): hidden until asked, Esc/backdrop/×
  close it. It never competes with the board.
- Truth tables render from data with 1s highlighted amber, reinforcing the
  signal-is-the-star language even in the docs.

---

## ADR-007 — Docs-first, phase-gated delivery
**Status:** Accepted · 2026-06-18

**Context.** How much to build before review, and in what order?

**Decision.** Write the planning docs first and get them reviewed before any
code. Then build strictly phase by phase per [roadmap.md](roadmap.md); each phase
ships something runnable and must meet its definition of done before the next
starts.

**Consequences.** Slower to first pixel, but every phase is a stable checkpoint
and the workflow stays legible across sessions. The roadmap is the contract for
"what's next."
