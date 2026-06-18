/*
 * core/engine.ts — the pure simulation (spec §9, architecture §4).
 * evaluate(circuit, registry) → SimResult. No DOM, no side effects, deterministic.
 * The whole v1 simulation is one topological pass; cycles are flagged, not hung.
 */

import type { Bit, Circuit, ComponentInstance, TerminalRef } from "./types";
import type { Inputs, Outputs, Registry } from "./registry";

export interface SimResult {
  /** Per component id: its output terminal values. */
  outputs: Map<string, Outputs>;
  /** Per component id: the resolved values at its input terminals (for LEDs/displays). */
  inputsOf: Map<string, Inputs>;
  /** Per wire id: the value flowing through it (its source output value). */
  wireValues: Map<string, Bit>;
  /** Diagnostics for the UI to surface (spec §9 cycle handling). */
  errors: { cycleWireIds: string[] };
}

const key = (ref: TerminalRef): string => `${ref.comp}:${ref.term}`;

export function evaluate(circuit: Circuit, registry: Registry): SimResult {
  const byId = new Map(circuit.components.map((c) => [c.id, c]));

  // The single wire feeding each input terminal (model enforces one-per-input).
  const feed = new Map<string, TerminalRef>(); // "comp:term" → source ref
  for (const w of circuit.wires) {
    if (byId.has(w.from.comp) && byId.has(w.to.comp)) feed.set(key(w.to), w.from);
  }

  // ---- Topological sort (Kahn's algorithm) over component nodes ----
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const c of circuit.components) {
    indeg.set(c.id, 0);
    adj.set(c.id, []);
  }
  for (const w of circuit.wires) {
    if (!byId.has(w.from.comp) || !byId.has(w.to.comp)) continue; // dangling wire
    adj.get(w.from.comp)!.push(w.to.comp);
    indeg.set(w.to.comp, indeg.get(w.to.comp)! + 1);
  }

  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id)!) {
      const d = indeg.get(next)! - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  // Anything left unplaced is part of a cycle (spec §9 / ADR-005).
  const placed = new Set(order);
  const cyclic = new Set(circuit.components.map((c) => c.id).filter((id) => !placed.has(id)));
  const cycleWireIds = circuit.wires
    .filter((w) => cyclic.has(w.from.comp) && cyclic.has(w.to.comp))
    .map((w) => w.id);

  // ---- Evaluate in topological order ----
  const outputs = new Map<string, Outputs>();
  const inputsOf = new Map<string, Inputs>();
  const valueAt = (ref: TerminalRef): Bit => (outputs.get(ref.comp)?.[ref.term] ?? 0) as Bit;

  const evalOne = (c: ComponentInstance): void => {
    const def = registry[c.type];
    if (!def) {
      outputs.set(c.id, {});
      return;
    }
    if (def.source) {
      // input toggle: output is the instance value, not a function of inputs.
      outputs.set(c.id, { [def.outputs[0] ?? "out0"]: c.value ?? 0 });
      return;
    }
    const ins: Inputs = {};
    for (const term of def.inputs) {
      const src = feed.get(`${c.id}:${term}`);
      ins[term] = src ? valueAt(src) : 0; // unconnected input defaults to 0
    }
    inputsOf.set(c.id, ins);
    outputs.set(c.id, def.evaluate(ins));
  };

  for (const id of order) evalOne(byId.get(id)!);
  for (const id of cyclic) if (!outputs.has(id)) outputs.set(id, {}); // cyclic → 0

  const wireValues = new Map<string, Bit>();
  for (const w of circuit.wires) wireValues.set(w.id, valueAt(w.from));

  return { outputs, inputsOf, wireValues, errors: { cycleWireIds } };
}
