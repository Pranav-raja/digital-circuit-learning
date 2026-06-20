/*
 * core/engine.ts — the pure simulation (spec §9, ADR-005). Pure, deterministic,
 * DOM-free. Phase 6 replaced the one-shot topological pass with ITERATIVE
 * SETTLING so feedback loops (flip-flops) work:
 *   1. sources (inputs/clocks) and sequential outputs are fixed for the pass;
 *   2. combinational gates are re-evaluated until their outputs stop changing
 *      (or a step cap is hit → the wires that never settle are flagged);
 *   3. sequential parts then COMMIT their state from the settled inputs (e.g. a
 *      flip-flop latches D on a clock edge), and we settle once more.
 * State is threaded in/out so the function stays pure (architecture §9).
 */

import type { Bit, Circuit, ComponentInstance, TerminalRef } from "./types";
import type { Inputs, Outputs, Registry } from "./registry";

/** Per-instance latch state for sequential parts (e.g. { q, lastClk }). */
export type CompState = Record<string, Bit>;
export type StateMap = Map<string, CompState>;

export interface SimResult {
  outputs: Map<string, Outputs>;
  inputsOf: Map<string, Inputs>;
  wireValues: Map<string, Bit>;
  errors: { cycleWireIds: string[] };
  state: StateMap; // next sequential state, fed back in on the following call
}

const MAX_ITERS = 80;
const key = (ref: TerminalRef): string => `${ref.comp}:${ref.term}`;

/** Equal on every key present in `next` (the freshly computed output set). */
function sameOutputs(prev: Outputs, next: Outputs): boolean {
  for (const k in next) if (prev[k] !== next[k]) return false;
  return true;
}

export function evaluate(circuit: Circuit, registry: Registry, prevState?: StateMap): SimResult {
  const byId = new Map(circuit.components.map((c) => [c.id, c]));

  // the single wire feeding each input terminal (model enforces one-per-input)
  const feed = new Map<string, TerminalRef>();
  for (const w of circuit.wires) {
    if (byId.has(w.from.comp) && byId.has(w.to.comp)) feed.set(key(w.to), w.from);
  }

  const outputs = new Map<string, Outputs>();
  const inputsOf = new Map<string, Inputs>();
  const state: StateMap = new Map();

  // Seed: sources output their value; sequential parts output their stored state;
  // combinational parts start empty and get computed during settling.
  for (const c of circuit.components) {
    const def = registry[c.type];
    if (!def) {
      outputs.set(c.id, {});
    } else if (def.source) {
      outputs.set(c.id, { [def.outputs[0] ?? "out0"]: (c.value ?? 0) as Bit });
    } else if (def.sequential) {
      const st = prevState?.get(c.id) ?? { ...def.sequential.initial };
      state.set(c.id, st);
      outputs.set(c.id, def.sequential.read(st));
    } else {
      outputs.set(c.id, {});
    }
  }

  const valueAt = (ref: TerminalRef): Bit => (outputs.get(ref.comp)?.[ref.term] ?? 0) as Bit;
  const gatherInputs = (c: ComponentInstance, def: { inputs: string[] }): Inputs => {
    const ins: Inputs = {};
    for (const term of def.inputs) {
      const src = feed.get(`${c.id}:${term}`);
      ins[term] = src ? valueAt(src) : 0; // unconnected input defaults to 0
    }
    return ins;
  };

  const combos = circuit.components.filter((c) => {
    const def = registry[c.type];
    return def && !def.source && !def.sequential;
  });

  /** Re-evaluate combinational parts until stable; return any oscillating ids. */
  const settle = (): Set<string> => {
    for (let i = 0; i < MAX_ITERS; i++) {
      let changed = false;
      for (const c of combos) {
        const def = registry[c.type]!;
        const ins = gatherInputs(c, def);
        inputsOf.set(c.id, ins);
        const out = def.evaluate(ins);
        if (!sameOutputs(outputs.get(c.id)!, out)) {
          outputs.set(c.id, out);
          changed = true;
        }
      }
      if (!changed) return new Set();
    }
    // Never settled → an oscillator. Two more passes find the still-toggling parts.
    const osc = new Set<string>();
    for (let i = 0; i < 2; i++) {
      for (const c of combos) {
        const def = registry[c.type]!;
        const ins = gatherInputs(c, def);
        inputsOf.set(c.id, ins);
        const out = def.evaluate(ins);
        if (!sameOutputs(outputs.get(c.id)!, out)) {
          osc.add(c.id);
          outputs.set(c.id, out);
        }
      }
    }
    return osc;
  };

  const oscillating = settle();

  // Commit sequential state from the settled inputs (edge detection lives here).
  let stateChanged = false;
  for (const c of circuit.components) {
    const def = registry[c.type];
    if (!def?.sequential) continue;
    const prev = state.get(c.id)!;
    const ins = gatherInputs(c, def);
    inputsOf.set(c.id, ins);
    const next = def.sequential.commit(ins, prev);
    let diff = false;
    for (const k in next) if (next[k] !== prev[k]) diff = true;
    if (diff) {
      state.set(c.id, next);
      outputs.set(c.id, def.sequential.read(next));
      stateChanged = true;
    }
  }
  if (stateChanged) for (const id of settle()) oscillating.add(id);

  // Resolve input values for every non-source part (for LEDs, displays, etc.).
  for (const c of circuit.components) {
    const def = registry[c.type];
    if (def && !def.source) inputsOf.set(c.id, gatherInputs(c, def));
  }

  const wireValues = new Map<string, Bit>();
  for (const w of circuit.wires) wireValues.set(w.id, valueAt(w.from));

  const cycleWireIds = circuit.wires.filter((w) => oscillating.has(w.from.comp)).map((w) => w.id);

  return { outputs, inputsOf, wireValues, errors: { cycleWireIds }, state };
}
