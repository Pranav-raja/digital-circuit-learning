/*
 * core/model.ts — create / mutate / validate circuit data (architecture §2).
 * The ONLY place circuit data is mutated, so id generation and the wiring rules
 * (one wire per input, outputs→inputs only) live in one spot. Pure data in/out.
 */

import type { Bit, Circuit, ComponentInstance, TerminalRef, Wire } from "./types";
import { SCHEMA_VERSION } from "./types";
import { REGISTRY } from "./registry";
import { snap } from "./geometry";

// ---- ids -------------------------------------------------------------------
let seq = 0;
const uid = (prefix: string): string => `${prefix}${++seq}`;

/** After loading a circuit, bump the counter past existing ids to avoid clashes. */
export function seedIds(circuit: Circuit): void {
  const tail = (id: string): number => parseInt(id.replace(/^\D+/, ""), 10) || 0;
  let max = seq;
  for (const c of circuit.components) max = Math.max(max, tail(c.id));
  for (const w of circuit.wires) max = Math.max(max, tail(w.id));
  seq = max;
}

// ---- creation --------------------------------------------------------------
export function createCircuit(name = "Untitled circuit"): Circuit {
  return { version: SCHEMA_VERSION, name, updatedAt: new Date().toISOString(), components: [], wires: [] };
}

const byId = (circuit: Circuit, id: string): ComponentInstance | undefined =>
  circuit.components.find((c) => c.id === id);

export function addComponent(
  circuit: Circuit,
  type: string,
  x: number,
  y: number,
  extra: Partial<ComponentInstance> = {},
): ComponentInstance {
  const comp: ComponentInstance = { id: uid("c"), type, x: snap(x), y: snap(y), ...extra };
  circuit.components.push(comp);
  return comp;
}

/** A → B → C … for input toggles. */
const inputLabel = (n: number): string =>
  n < 26 ? String.fromCharCode(65 + n) : `IN${n}`;

export function addInput(circuit: Circuit): ComponentInstance {
  const n = circuit.components.filter((c) => c.type === "input").length;
  return addComponent(circuit, "input", 0, 0, { value: 0, label: inputLabel(n) });
}

export function addOutput(circuit: Circuit): ComponentInstance {
  const n = circuit.components.filter((c) => c.type === "output").length;
  return addComponent(circuit, "output", 0, 0, { label: `OUT ${n}` });
}

// ---- mutation --------------------------------------------------------------
export function moveComponent(circuit: Circuit, id: string, x: number, y: number): void {
  const c = byId(circuit, id);
  if (c) {
    c.x = snap(x);
    c.y = snap(y);
  }
}

export function toggleInput(circuit: Circuit, id: string): void {
  const c = byId(circuit, id);
  if (c && c.type === "input") c.value = (c.value ? 0 : 1) as Bit;
}

export function removeComponent(circuit: Circuit, id: string): void {
  circuit.components = circuit.components.filter((c) => c.id !== id);
  circuit.wires = circuit.wires.filter((w) => w.from.comp !== id && w.to.comp !== id);
}

export function removeWire(circuit: Circuit, id: string): void {
  circuit.wires = circuit.wires.filter((w) => w.id !== id);
}

/** Remove a component OR a wire by id, whichever it is. */
export function removeById(circuit: Circuit, id: string): void {
  if (circuit.wires.some((w) => w.id === id)) removeWire(circuit, id);
  else removeComponent(circuit, id);
}

export type WireResult = { ok: true; wire: Wire } | { ok: false; reason: string };

/**
 * Connect an output terminal to an input terminal. Enforces the §7 rules:
 * outputs→inputs only, no self-wiring, and one wire per input (last wins).
 */
export function addWire(circuit: Circuit, from: TerminalRef, to: TerminalRef): WireResult {
  const fromC = byId(circuit, from.comp);
  const toC = byId(circuit, to.comp);
  if (!fromC || !toC) return { ok: false, reason: "That part is gone." };
  if (from.comp === to.comp) return { ok: false, reason: "Can't wire a part to itself." };

  const fromDef = REGISTRY[fromC.type];
  const toDef = REGISTRY[toC.type];
  if (!fromDef?.outputs.includes(from.term)) return { ok: false, reason: "Wires start at an output." };
  if (!toDef?.inputs.includes(to.term)) return { ok: false, reason: "Wires end at an input." };

  // One wire per input: drop any existing wire on this input (last wins, §7).
  circuit.wires = circuit.wires.filter((w) => !(w.to.comp === to.comp && w.to.term === to.term));

  const wire: Wire = { id: uid("w"), from: { ...from }, to: { ...to } };
  circuit.wires.push(wire);
  return { ok: true, wire };
}

// ---- validation (used by file import in Phase 3) ---------------------------
export type ValidateResult = { ok: true; circuit: Circuit } | { ok: false; error: string };

export function validateCircuit(data: unknown): ValidateResult {
  if (typeof data !== "object" || data === null) return { ok: false, error: "That file isn't a circuit." };
  const c = data as Partial<Circuit>;
  if (typeof c.version !== "number") return { ok: false, error: "That file looks corrupted." };
  if (c.version > SCHEMA_VERSION)
    return { ok: false, error: "This file was made with a newer version of Logic Lab." };
  if (!Array.isArray(c.components) || !Array.isArray(c.wires))
    return { ok: false, error: "That file looks corrupted." };
  return { ok: true, circuit: c as Circuit };
}
