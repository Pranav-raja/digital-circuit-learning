/*
 * core/engine.ts — the pure simulation (spec §9, ADR-005). Pure, deterministic,
 * DOM-free. Iterative SETTLING (Phase 6) so feedback loops (flip-flops) work:
 *   1. sources (inputs/clocks) and sequential outputs are fixed for the pass;
 *   2. combinational gates re-evaluate until stable (capped → unstable wires flag);
 *   3. sequential parts COMMIT state from settled inputs (edge detection), settle again.
 * Subcircuit blocks (type "sub") are combinational from the caller's view: their
 * evaluate recursively runs the captured internal circuit (Phase 6). State is
 * threaded in/out so the function stays pure (architecture §9).
 */

import type { Bit, Circuit, ComponentInstance, SubcircuitDef, TerminalRef } from "./types";
import type { ComponentDef, Inputs, Outputs, Registry } from "./registry";

export type CompState = Record<string, Bit>;
export type StateMap = Map<string, CompState>;

export interface SimResult {
  outputs: Map<string, Outputs>;
  inputsOf: Map<string, Inputs>;
  wireValues: Map<string, Bit>;
  errors: { cycleWireIds: string[] };
  state: StateMap;
}

const MAX_ITERS = 80;
const MAX_DEPTH = 24; // subcircuit nesting guard (also stops accidental recursion)
const key = (ref: TerminalRef): string => `${ref.comp}:${ref.term}`;

/** Index a circuit's reusable blocks by id, for the engine + recursion. */
export const buildSubs = (circuit: Circuit): Map<string, SubcircuitDef> =>
  new Map((circuit.subcircuits ?? []).map((d) => [d.id, d]));

function sameOutputs(prev: Outputs, next: Outputs): boolean {
  for (const k in next) if (prev[k] !== next[k]) return false;
  return true;
}

/** Run a block's internals: drive its input components, read its output components. */
function evalSub(
  sd: SubcircuitDef,
  ins: Inputs,
  registry: Registry,
  subs: Map<string, SubcircuitDef>,
  depth: number,
): Outputs {
  if (depth > MAX_DEPTH) return {};
  const inputVal = new Map<string, Bit>();
  sd.inputs.forEach((p, i) => inputVal.set(p.id, (ins[`in${i}`] ?? 0) as Bit));
  const view: Circuit = {
    ...sd.circuit,
    components: sd.circuit.components.map((c) =>
      inputVal.has(c.id) ? { ...c, value: inputVal.get(c.id) } : c,
    ),
  };
  const r = evaluate(view, registry, undefined, subs, depth);
  const out: Outputs = {};
  sd.outputs.forEach((p, i) => {
    out[`out${i}`] = (r.inputsOf.get(p.id)?.in0 ?? 0) as Bit;
  });
  return out;
}

export function evaluate(
  circuit: Circuit,
  registry: Registry,
  prevState?: StateMap,
  subs?: Map<string, SubcircuitDef>,
  depth = 0,
): SimResult {
  if (depth > MAX_DEPTH) {
    return {
      outputs: new Map(),
      inputsOf: new Map(),
      wireValues: new Map(),
      errors: { cycleWireIds: [] },
      state: new Map(),
    };
  }

  const subMap = subs ?? buildSubs(circuit);
  const byId = new Map(circuit.components.map((c) => [c.id, c]));

  // Resolve a component's definition: registry entry, or a synthetic def for a block.
  const synthCache = new Map<string, ComponentDef>();
  const defOf = (c: ComponentInstance): ComponentDef | undefined => {
    if (c.type !== "sub") return registry[c.type];
    const sd = c.subId ? subMap.get(c.subId) : undefined;
    if (!sd) return undefined;
    let d = synthCache.get(sd.id);
    if (!d) {
      d = {
        label: sd.name,
        category: "selectors",
        render: "block",
        inputs: sd.inputs.map((_, i) => `in${i}`),
        outputs: sd.outputs.map((_, i) => `out${i}`),
        evaluate: (ins) => evalSub(sd, ins, registry, subMap, depth + 1),
      };
      synthCache.set(sd.id, d);
    }
    return d;
  };

  // the single wire feeding each input terminal (model enforces one-per-input)
  const feed = new Map<string, TerminalRef>();
  for (const w of circuit.wires) {
    if (byId.has(w.from.comp) && byId.has(w.to.comp)) feed.set(key(w.to), w.from);
  }

  const outputs = new Map<string, Outputs>();
  const inputsOf = new Map<string, Inputs>();
  const state: StateMap = new Map();

  for (const c of circuit.components) {
    const def = defOf(c);
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
    const def = defOf(c);
    return def && !def.source && !def.sequential;
  });

  /** Re-evaluate combinational parts until stable; return any oscillating ids. */
  const settle = (): Set<string> => {
    for (let i = 0; i < MAX_ITERS; i++) {
      let changed = false;
      for (const c of combos) {
        const def = defOf(c)!;
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
    const osc = new Set<string>();
    for (let i = 0; i < 2; i++) {
      for (const c of combos) {
        const def = defOf(c)!;
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

  let stateChanged = false;
  for (const c of circuit.components) {
    const def = defOf(c);
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

  for (const c of circuit.components) {
    const def = defOf(c);
    if (def && !def.source) inputsOf.set(c.id, gatherInputs(c, def));
  }

  const wireValues = new Map<string, Bit>();
  for (const w of circuit.wires) wireValues.set(w.id, valueAt(w.from));

  const cycleWireIds = circuit.wires.filter((w) => oscillating.has(w.from.comp)).map((w) => w.id);

  return { outputs, inputsOf, wireValues, errors: { cycleWireIds }, state };
}
