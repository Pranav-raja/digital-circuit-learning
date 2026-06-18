# Logic Lab — Documentation

A browser-based logic circuit simulator for students learning computer
architecture. Place gates, wire them up, flip inputs, watch signals light up.
No backend, no accounts — work lives in the browser and travels as a file.

This folder is the project's brain. The spec is the *what* and *why*; the rest
is the *how* and the *where-we-are*.

## The docs, and what each is for

| Doc | Role | When to read it |
|---|---|---|
| [logic-lab-build-spec.md](logic-lab-build-spec.md) | **Source of truth.** Product vision, UX guardrails, visual system, component catalog, data model, roadmap. Authored upstream; we don't contradict it. | Before any feature, to recover intent. |
| [decisions.md](decisions.md) | **ADR log.** Every choice that closes a fork — stack, name, architecture rules. Durable record of *why*. | Before reopening a settled question. |
| [architecture.md](architecture.md) | **Engineering blueprint.** Concrete TypeScript contracts, module boundaries, the simulation algorithm, test strategy. The bridge from spec → code. | Before writing any module. |
| [roadmap.md](roadmap.md) | **Living workflow tracker.** Phases 0–6 as checklists, each with a definition of done and UX acceptance criteria. This is what we keep up to date. | At the start and end of every work session. |

## How the workflow stays honest

1. **Pick the current phase** in [roadmap.md](roadmap.md). Phases ship something
   runnable; don't start phase _n+1_ until phase _n_ meets its definition of done.
2. **Build against the contracts** in [architecture.md](architecture.md). If a
   contract has to change, change the doc in the same commit as the code.
3. **Tick the boxes** in [roadmap.md](roadmap.md) as tasks land. A checked box
   means "done *and* meets its acceptance criteria," not "started."
4. **Log forks** in [decisions.md](decisions.md). If you make a call the spec
   left open, write an ADR so the next session doesn't relitigate it.

The cardinal rule (from spec §11): **`core/` imports nothing from `ui/` or
`canvas/`.** The simulation brain stays clean of the DOM body. Everything else
is negotiable; this is not.

## Status at a glance

- **Decided:** stack (Vite + TypeScript + hand-rolled SVG), name (Logic Lab).
- **Current phase:** Phase 1 implemented — a working combinational simulator
  (registry, pure engine, drag-to-wire, live sim). typecheck / lint / 8 engine
  tests / build all clean; awaiting visual sign-off.
- **Next:** Phase 2 — autosave to localStorage, undo/redo, status heartbeat.

## Running it

```
npm install      # already done
npm run dev      # http://localhost:5173 — the app
npm run build    # typecheck + production build
npm run test     # vitest — engine truth-table tests
npm run lint     # eslint (flat config)
```
