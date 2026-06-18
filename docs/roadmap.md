# Roadmap & Workflow Tracker

The living document. Build strictly phase by phase (spec §12); each phase ships
something **runnable** and must meet its **Definition of Done (DoD)** before the
next begins. Tick boxes only when done *and* the acceptance criteria hold.

**Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

**Current position:** pre–Phase 0. Planning docs complete; no code yet.

---

## Phase 0 — Scaffold · _empty but on-brand_

Goal: a runnable shell that already *looks* like Logic Lab.

- [ ] `npm create vite` (vanilla-ts), strip the demo, commit a clean baseline.
- [ ] `tsconfig` with `strict: true`; ESLint + Prettier wired.
- [ ] `styles/tokens.css` — every §5 color/type/spacing custom property.
- [ ] `styles/app.css` — three-zone layout: topbar, palette drawer, input rail,
      center board, output rail, status bar (static, no behavior).
- [ ] Blueprint-grid canvas background; Space Grotesk / Inter / JetBrains Mono
      loaded.
- [ ] Empty-state invitation on the board (spec §13).

**DoD:** `npm run dev` shows the full shell, on-brand, no console errors. Dark
theme by default. Nothing interactive yet — and that's correct.

---

## Phase 1 — A circuit that works · _the milestone; prioritize it_

Goal: place gates, wire them, flip inputs, watch outputs light up.

- [ ] `core/types.ts` + `core/registry.ts` with AND/OR/NOT + input/output.
- [ ] `core/engine.ts` — topological evaluate; unit tests green.
- [ ] `core/model.ts` — create/mutate/validate; id generation; one-wire-per-input.
- [ ] `core/geometry.ts` — terminal positions, wire Bézier, grid snap.
- [ ] `store.ts` — observable state + recompute-on-change loop.
- [ ] Palette: click a part to drop it at viewport center (drag can come later).
- [ ] Canvas renders components + terminals from state.
- [ ] Input rail with "+ Add input"; output rail with "+ Add output".
- [ ] Drag-to-wire: press output terminal → Bézier preview → release on input
      commits; release on empty discards; `Esc` cancels.
- [ ] Toggle an input → whole circuit re-evaluates → LEDs and live wires update.
- [ ] Move a component by its body; connected wires follow.
- [ ] Select + `Delete` removes component/wire and attached wires.

**DoD:** build a half-adder by hand (2 inputs, AND + XOR-via-gates or AND/OR/NOT,
2 outputs) and it computes correctly as you flip inputs. Engine tests pass.

**UX acceptance (spec §2, §7):**
- HIGH wire is unmistakably distinct from LOW (even before animation).
- Interaction is decided by *where* you click (terminal vs. body) — no mode
  toggle anywhere.
- An input terminal rejects a second wire with a soft shake or last-wins, with a
  plain message — never a silent failure or crash.

---

## Phase 2 — Don't-lose-my-work

- [ ] `storage/local.ts` — autosave debounced ~800ms → `logiclab:current`.
- [ ] On load, restore the autosaved circuit.
- [ ] Status-bar heartbeat ("saved 12s ago"), driven by `savedAt`.
- [ ] Undo/redo stack (`Ctrl/Cmd+Z`, redo) over circuit mutations.

**DoD:** make changes, reload the tab → work returns. Every destructive action
(delete, clear) is undoable. Heartbeat reflects real save times.

**UX acceptance:** losing work is "nearly impossible" (rule #4) and *visibly* so
— the heartbeat is the proof.

---

## Phase 3 — Files & saves

- [ ] `storage/files.ts` — export `<name>.json` via Blob + temp `<a download>`.
- [ ] Import via file picker; validate `version` + shape before loading.
- [ ] Drag a `.json` onto the canvas to import.
- [ ] Named "My Circuits" list in `logiclab:saved:<id>`, reachable from `Open ▾`.
- [ ] Graceful messages: corrupt file, wrong version, localStorage full.

**DoD:** export a circuit, clear the app, re-import the file → identical circuit.
Bad files show a human message, never a stack trace.

---

## Phase 4 — Polish the feel

- [ ] Signal-flow animation on HIGH wires (traveling pulse, ~2s, low opacity).
- [ ] `prefers-reduced-motion` → static glow fallback.
- [ ] Hover/selection states; cyan focus rings everywhere (rule #5, §13).
- [ ] Pan (space-drag / middle-mouse) + zoom-toward-cursor (scroll).
- [ ] "Fit to content" control in the status bar.
- [ ] Full keyboard shortcuts: undo, save, delete, select-all, Esc (§7).
- [ ] Light theme + `prefers-color-scheme` respect.

**DoD:** the signal is the star — watching a HIGH signal travel left→right is
legible and calm, not noisy. Reduced-motion and light theme both verified.

---

## Phase 5 — Richer parts

Each is (mostly) a registry entry; the display needs a custom renderer.

- [ ] XOR, XNOR, NAND, NOR (registry entries + gate glyphs).
- [ ] 2:1 MUX, 4:1 MUX.
- [ ] Half adder, full adder.
- [ ] 7-segment display (4-bit BCD) — custom `seven-seg` renderer.
- [ ] Palette categories populated and collapsible (Gates / I/O / Display /
      Arithmetic / Selectors / Atoms).

**DoD:** each new part wires up and simulates correctly; adding one required no
change outside its registry entry (and, for the display, its renderer).

---

## Phase 6 — Stretch

Out of v1 scope; capture intent, don't start until 0–5 are solid.

- [ ] Sequential engine: iterative settling (evaluate until stable or step cap).
- [ ] Clock + flip-flops (depends on the above).
- [ ] Transistor "build-an-AND-from-switches" mode (Atoms category).
- [ ] Subcircuits: collapse a circuit into a reusable block.
- [ ] Guided lesson / tutorial overlay.
- [ ] Touch support (mobile is desktop-first stretch only).

---

## Quality floor — applies to every phase (spec §13)

Re-check these as features land; they are not a separate phase.

- [ ] Keyboard accessible: visible cyan focus rings, Tab through palette/toolbar.
- [ ] Reduced motion respected.
- [ ] Empty state guides rather than voids.
- [ ] Errors speak plainly, in the app's voice — never a stack trace.
- [ ] Engine has truth-table unit tests (the silent-bug guard).

---

## Working notes

- Keep this file current at the start and end of each session — it's the
  hand-off between sessions.
- When a fork gets settled mid-build, add an ADR to
  [decisions.md](decisions.md) rather than burying the rationale here.
- A checked box is a promise: done **and** meets its acceptance criteria.
