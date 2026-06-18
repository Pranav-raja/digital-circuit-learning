# Roadmap & Workflow Tracker

The living document. Build strictly phase by phase (spec §12); each phase ships
something **runnable** and must meet its **Definition of Done (DoD)** before the
next begins. Tick boxes only when done *and* the acceptance criteria hold.

**Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

**Current position:** Phase 1 implemented (2026-06-18) — automated checks green;
awaiting visual/interaction sign-off. Next: Phase 2.

---

## Phase 0 — Scaffold · _empty but on-brand_ ✅ done

Goal: a runnable shell that already *looks* like Logic Lab.

- [x] Vite + TypeScript project scaffolded by hand (clean baseline, no demo cruft).
- [x] `tsconfig` with `strict: true`; ESLint (flat) + Prettier wired. Lint clean.
- [x] `styles/tokens.css` — every §5 color/type/spacing custom property (+ light theme block).
- [x] `styles/app.css` — three-zone layout: topbar, palette drawer, input rail,
      center board, output rail, status bar (static, no behavior).
- [x] Blueprint-grid canvas background (fine 24px + coarse 120px); Space Grotesk /
      Inter / JetBrains Mono loaded via Google Fonts.
- [x] Empty-state invitation on the board (spec §13).

**DoD:** ✅ `npm run typecheck`, `npm run lint`, and `npm run build` all clean;
`npm run dev` serves the full shell, on-brand, dark theme by default. Sample rail
toggles/LEDs showcase the amber/slate signal system. Nothing interactive yet —
and that's correct.

**Notes for Phase 1.** The palette categories, rail entries, and `▶ Run` button
are static stubs in `src/main.ts`; they get replaced by live, store-driven
modules. The center `.board` is a CSS-grid div for now — Phase 1 introduces the
real `<svg>` canvas (`canvas/Canvas.ts`).

---

## Phase 1 — A circuit that works · _the milestone_ ✅ implemented

Goal: place gates, wire them, flip inputs, watch outputs light up.

- [x] `core/types.ts` + `core/registry.ts` with AND/OR/NOT + input/output.
- [x] `core/engine.ts` — topological evaluate; 8 unit tests green.
- [x] `core/model.ts` — create/mutate/validate; id generation; one-wire-per-input.
- [x] `core/geometry.ts` — terminal positions, wire Bézier, grid snap.
- [x] `store.ts` — observable state + recompute-on-change loop.
- [x] Palette: click a part to drop it (gates at center; I/O append to rails).
- [x] Canvas renders components + terminals from state (single model-space SVG).
- [x] Input rail with "+ Add input"; output rail with "+ Add output" (auto-dock).
- [x] Drag-to-wire: press output terminal → Bézier preview → release on input
      commits; release on empty discards; `Esc` cancels.
- [x] Toggle an input → whole circuit re-evaluates → LEDs and live wires update.
- [x] Move a gate by its body; connected wires follow.
- [x] Select + `Delete`/`Backspace` removes component/wire and attached wires.

**DoD:** ✅ engine-verified (the half-adder truth table is a passing test) ·
⏳ awaiting interactive build-by-hand sign-off (needs a human at the screen).

**Verification status**
- ✅ Automated: typecheck, lint, 8 engine tests, production build — all clean.
- ⏳ Manual (please confirm): place AND/OR/NOT + I/O, drag wires, flip inputs,
  watch LEDs/wires light amber; the half-adder computes; Delete + Esc behave.

**UX acceptance (spec §2, §7)** — built to these; confirm visually:
- HIGH wire/LED/terminal render amber; LOW render dim slate — clearly distinct.
- Interaction is decided by *where* you click (terminal → wire, body → move,
  toggle → flip) — no mode toggle anywhere.
- An input accepts one wire (last wins): re-wiring an input drops the old wire.

**Deliberately deferred (not regressions):**
- Marquee group-select/move → Phase 4 (single-select ships now).
- Pan/zoom + fit-to-content → Phase 4 (the board is static this phase).
- Drag-from-palette → Phase 4 (click-to-drop ships now).
- IEEE gate glyphs → Phase 5 (labeled angular boxes ship now).

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
