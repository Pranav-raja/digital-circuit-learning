# Roadmap & Workflow Tracker

The living document. Build strictly phase by phase (spec §12); each phase ships
something **runnable** and must meet its **Definition of Done (DoD)** before the
next begins. Tick boxes only when done *and* the acceptance criteria hold.

**Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

**Current position:** Phase 5 implemented (2026-06-20) — automated checks green;
awaiting visual/interaction sign-off. Next: Phase 6 (stretch) or wrap v1.

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

## Phase 2 — Don't-lose-my-work ✅ implemented

- [x] `storage/local.ts` — autosave debounced ~800ms → `logiclab:current`;
      skips redundant writes by comparing `updatedAt`; graceful quota message.
- [x] On load, restore the autosaved circuit (`loadCurrent` → `loadCircuit`).
- [x] Status-bar heartbeat ("saved 12s ago"), ticking every second.
- [x] Undo/redo over circuit mutations (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` / `Ctrl+Y`),
      snapshot history; one entry per drag gesture; `Ctrl/Cmd+S` forces a save.

**DoD:** ✅ logic in place + tests green · ⏳ awaiting reload/undo sign-off.

**Verification status**
- ✅ Automated: typecheck, lint, 14 tests (engine + model round-trip), build — clean.
- ⏳ Manual (please confirm): make changes → reload tab → work returns; heartbeat
  shows "saved …"; `Ctrl+Z` undoes add/delete/move/toggle/wire; redo restores.

**UX acceptance:** losing work is "nearly impossible" (rule #4) and *visibly* so
— the heartbeat is the proof.

**Design notes / deferred:**
- "New" + named-save buttons stay stubbed until Phase 3 (named "My Circuits").
- Undo coalesces a whole drag into one step (checkpoint on first move).
- History cap: 100 snapshots (structuredClone); fine at v1 circuit sizes.

---

## Phase 3 — Files & saves ✅ implemented

- [x] `storage/files.ts` — export `<name>.json` via Blob + temp `<a download>`.
- [x] Import via file picker (`pickAndImport`); validates `version` + shape.
- [x] Drag a `.json` onto the board to import (with a cyan drop affordance).
- [x] Named "My Circuits" list in `logiclab:saved:<id>` + index, under `Open ▾`
      (load + delete; save-by-name overwrites a matching name).
- [x] Graceful messages: corrupt file, newer version, storage full — all routed
      through the status bar in the app's voice (spec §13).
- [x] `New` clears to a fresh circuit (undoable).

**DoD:** ✅ round-trip proven by the model test (Circuit → JSON → Circuit equals)
· ⏳ awaiting export-file/re-import sign-off in the browser.

**Verification status**
- ✅ Automated: typecheck, lint, 14 tests, build (19 modules) — all clean.
- ⏳ Manual (please confirm): Export downloads `<name>.json`; New clears; Import
  / drag-drop restores it; Save names it; Open ▾ lists, loads, and deletes; a
  hand-corrupted file shows a plain message, not a crash.

**Design notes / deferred:**
- Save-name uses a native `window.prompt` for now; a styled in-app modal is a
  Phase 4 polish item (keeps the app's voice consistent).
- Named saves overwrite by matching name (no silent duplicates).

---

## Phase 4 — Polish the feel ✅ implemented

- [x] Signal-flow animation on HIGH wires (traveling pulse, 1.8s, overlaid stroke).
- [x] `prefers-reduced-motion` → pulse hidden, static glow on `.wire.is-high` stays.
- [x] Hover/selection states; cyan focus rings on buttons/chips/menu/fit.
- [x] Pan (space-drag / middle-mouse) + zoom-toward-cursor (scroll); grid tracks
      the viewport. Inputs/outputs stay pinned to their rails; gates pan/zoom.
- [x] "Fit to content" button in the status bar; live zoom % readout.
- [x] Full keyboard shortcuts: undo/redo, save, delete, select-all, Esc (§7).
- [x] Light theme toggle + `prefers-color-scheme` respect (remembered choice).

**DoD:** ✅ built to spec · ⏳ awaiting the visual "signal is the star" sign-off
(pulse legibility, reduced-motion, light theme) — needs a human at the screen.

**Verification status**
- ✅ Automated: typecheck, lint, 14 tests, build (20 modules) — all clean.
- ⏳ Manual (please confirm): live wires show a calm left→right pulse; scroll
  zooms toward cursor; space/middle-drag pans; Fit frames the gates; the theme
  toggle (☀/☾) flips light/dark and is remembered across reloads.

**Architecture note (important).** This phase introduced the viewport: gates +
wires render in a pan/zoom WORLD `<g transform>`; inputs/outputs render PINNED in
screen space; wires bridge via `terminalScreen()`. `clientToWorld` / `clientToScreen`
replaced the old `clientToModel`. See [architecture.md §6] if extending the canvas.

**Deferred:** styled in-app Save modal (still native `prompt`); drag-from-palette.

---

## Phase 5 — Richer parts ✅ implemented

Each is (mostly) a registry entry; the display needs a custom renderer.

- [x] XOR, XNOR, NAND, NOR — pure registry entries (default gate renderer).
- [x] 2:1 MUX, 4:1 MUX — registry entries with `sublabel` + `pinLabels`.
- [x] Half adder, full adder — registry entries (`sum`/`carry` output terminals).
- [x] 7-segment display (4-bit BCD, in0 = LSB) — custom `seven-seg` renderer.
- [x] Palette categories populated; live parts carry `data-type`, the rest dimmed.

**DoD:** ✅ every new part has a passing truth-table test; the gates needed ONLY
registry entries. One-time generic renderer additions (`sublabel`, `pinLabels`,
`width`) keep MUX/adders data-only; the display has its own renderer (as allowed).
⏳ awaiting visual sign-off (glyphs, pin labels, lit segments).

**Verification status**
- ✅ Automated: typecheck, lint, 19 tests (incl. MUX/adder/XOR-family), build — clean.
- ⏳ Manual (please confirm): drop a 7-segment + 4 inputs (weights 1/2/4/8) → it
  shows 0–F as you toggle; MUX selects; half/full adder compute; pin labels read.

**Deferred to stretch:** multi-digit number display; n-bit adder/subtractor;
decoder; transistor atoms; IEEE-shaped gate glyphs (labeled boxes ship now).

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
