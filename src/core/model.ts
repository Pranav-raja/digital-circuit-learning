/*
 * core/model.ts — create / mutate / validate circuit data (architecture §2).
 * The ONLY place circuit data is mutated, so id generation and the wiring rules
 * (one wire per input, outputs→inputs only) live in one spot. Pure data in/out.
 */

import type { Bit, Circuit, ComponentInstance, SubcircuitDef, TerminalRef, Wire } from "./types";
import { SCHEMA_VERSION } from "./types";
import { REGISTRY } from "./registry";
import { snap } from "./geometry";

// ---- ids -------------------------------------------------------------------
let seq = 0;
const uid = (prefix: string): string => `${prefix}${++seq}`;
const tail = (id: string): number => parseInt(id.replace(/^\D+/, ""), 10) || 0;

/** After loading a circuit, bump the counter past every existing id (including
 * those buried in subcircuit definitions) to avoid clashes. */
export function seedIds(circuit: Circuit): void {
  let max = seq;
  const scan = (c: Circuit): void => {
    for (const x of c.components) max = Math.max(max, tail(x.id));
    for (const w of c.wires) max = Math.max(max, tail(w.id));
    for (const d of c.subcircuits ?? []) {
      max = Math.max(max, tail(d.id));
      scan(d.circuit);
    }
  };
  scan(circuit);
  seq = max;
}

// ---- creation --------------------------------------------------------------
export function createCircuit(name = "Untitled circuit"): Circuit {
  return {
    version: SCHEMA_VERSION,
    name,
    updatedAt: new Date().toISOString(),
    components: [],
    wires: [],
    subcircuits: [],
  };
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

/** Terminal names of a component — registry-defined, or derived for a block. */
function terminalsOf(
  circuit: Circuit,
  comp: ComponentInstance,
): { inputs: string[]; outputs: string[] } | null {
  if (comp.type === "sub") {
    const sd = comp.subId ? (circuit.subcircuits ?? []).find((d) => d.id === comp.subId) : undefined;
    return sd
      ? { inputs: sd.inputs.map((_, i) => `in${i}`), outputs: sd.outputs.map((_, i) => `out${i}`) }
      : null;
  }
  const def = REGISTRY[comp.type];
  return def ? { inputs: def.inputs, outputs: def.outputs } : null;
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
  // Self-feedback is allowed (e.g. a flip-flop's Q' → D); the engine settles or
  // flags oscillating loops rather than forbidding them (Phase 6).

  const fromT = terminalsOf(circuit, fromC);
  const toT = terminalsOf(circuit, toC);
  if (!fromT?.outputs.includes(from.term)) return { ok: false, reason: "Wires start at an output." };
  if (!toT?.inputs.includes(to.term)) return { ok: false, reason: "Wires end at an input." };

  // One wire per input: drop any existing wire on this input (last wins, §7).
  circuit.wires = circuit.wires.filter((w) => !(w.to.comp === to.comp && w.to.term === to.term));

  const wire: Wire = { id: uid("w"), from: { ...from }, to: { ...to } };
  circuit.wires.push(wire);
  return { ok: true, wire };
}

// ---- subcircuits / blocks (Phase 6) ----------------------------------------
export function addSubInstance(
  circuit: Circuit,
  subId: string,
  x: number,
  y: number,
): ComponentInstance {
  return addComponent(circuit, "sub", x, y, { subId });
}

export type GroupResult =
  | { ok: true; instance: ComponentInstance; dropped: number }
  | { ok: false; reason: string };

const refKey = (r: TerminalRef): string => `${r.comp}:${r.term}`;

/**
 * Collapse the selected components into a reusable block (spec §12, Phase 6).
 * The block's pins come from BOTH the input/output components inside the
 * selection AND every wire that crosses the selection boundary — so the pin
 * count always matches the signals entering/leaving the block, and those
 * external wires are RECONNECTED to the new block (nothing is silently dropped).
 */
export function groupSelection(circuit: Circuit, ids: string[], name: string): GroupResult {
  const sel = new Set(ids);
  const selComps = circuit.components.filter((c) => sel.has(c.id));
  if (selComps.length === 0) return { ok: false, reason: "Select parts to group first." };

  const internalWires = circuit.wires.filter((w) => sel.has(w.from.comp) && sel.has(w.to.comp));
  const boundaryIn = circuit.wires.filter((w) => !sel.has(w.from.comp) && sel.has(w.to.comp));
  const boundaryOut = circuit.wires.filter((w) => sel.has(w.from.comp) && !sel.has(w.to.comp));

  const components: ComponentInstance[] = structuredClone(selComps);
  const wires: Wire[] = structuredClone(internalWires);
  const inputs: { id: string; label: string }[] = [];
  const outputs: { id: string; label: string }[] = [];
  const reInputs: { ext: TerminalRef; port: number }[] = []; // ext.out → block.in{port}
  const reOutputs: { port: number; ext: TerminalRef }[] = []; // block.out{port} → ext.in

  // Existing internal I/O components are the block's pins as-is.
  for (const c of selComps.filter((c) => c.type === "input")) inputs.push({ id: c.id, label: c.label ?? "IN" });
  for (const c of selComps.filter((c) => c.type === "output")) outputs.push({ id: c.id, label: c.label ?? "OUT" });

  // Each external source feeding the selection → one input pin (fan-in merged),
  // realised as a synthetic internal input component driving the same targets.
  const byExtSource = new Map<string, { ext: TerminalRef; targets: TerminalRef[] }>();
  for (const w of boundaryIn) {
    const e = (byExtSource.get(refKey(w.from)) ?? { ext: w.from, targets: [] });
    e.targets.push(w.to);
    byExtSource.set(refKey(w.from), e);
  }
  for (const { ext, targets } of byExtSource.values()) {
    const pin: ComponentInstance = { id: uid("c"), type: "input", x: 0, y: 0, value: 0, label: inputLabel(inputs.length) };
    components.push(pin);
    for (const t of targets) wires.push({ id: uid("w"), from: { comp: pin.id, term: "out0" }, to: { ...t } });
    reInputs.push({ ext, port: inputs.length });
    inputs.push({ id: pin.id, label: pin.label! });
  }

  // Each internal source feeding outside → one output pin (fan-out preserved).
  const byIntSource = new Map<string, { src: TerminalRef; targets: TerminalRef[] }>();
  for (const w of boundaryOut) {
    const e = (byIntSource.get(refKey(w.from)) ?? { src: w.from, targets: [] });
    e.targets.push(w.to);
    byIntSource.set(refKey(w.from), e);
  }
  for (const { src, targets } of byIntSource.values()) {
    const pin: ComponentInstance = { id: uid("c"), type: "output", x: 0, y: 0, label: `OUT ${outputs.length}` };
    components.push(pin);
    wires.push({ id: uid("w"), from: { ...src }, to: { comp: pin.id, term: "in0" } });
    for (const t of targets) reOutputs.push({ port: outputs.length, ext: t });
    outputs.push({ id: pin.id, label: pin.label! });
  }

  const def: SubcircuitDef = {
    id: uid("sub"),
    name,
    circuit: {
      version: SCHEMA_VERSION,
      name,
      updatedAt: new Date().toISOString(),
      components,
      wires,
      subcircuits: [],
    },
    inputs,
    outputs,
  };

  // Place the block at the centroid of the selected gates (fall back to all).
  const ref = selComps.filter((c) => c.type !== "input" && c.type !== "output");
  const at = ref.length ? ref : selComps;
  const cx = Math.round(at.reduce((s, c) => s + c.x, 0) / at.length);
  const cy = Math.round(at.reduce((s, c) => s + c.y, 0) / at.length);

  (circuit.subcircuits ??= []).push(def);
  for (const id of sel) removeComponent(circuit, id); // drops internal + boundary wires
  const instance = addComponent(circuit, "sub", cx, cy, { subId: def.id });

  // Reconnect the boundary to the block's new pins.
  for (const { ext, port } of reInputs) {
    circuit.wires.push({ id: uid("w"), from: { ...ext }, to: { comp: instance.id, term: `in${port}` } });
  }
  for (const { port, ext } of reOutputs) {
    circuit.wires = circuit.wires.filter((w) => !(w.to.comp === ext.comp && w.to.term === ext.term));
    circuit.wires.push({ id: uid("w"), from: { comp: instance.id, term: `out${port}` }, to: { ...ext } });
  }

  return { ok: true, instance, dropped: 0 };
}

export type DeleteSubResult =
  | { ok: true; removedInstances: number }
  | { ok: false; reason: string };

/**
 * Delete a block definition and every instance of it on the board (undoable via
 * the caller's checkpoint). Refused if the block is nested inside another block,
 * which would leave that block broken.
 */
export function deleteSubcircuit(circuit: Circuit, defId: string): DeleteSubResult {
  const defs = circuit.subcircuits ?? [];
  if (!defs.some((d) => d.id === defId)) return { ok: false, reason: "That block is already gone." };

  const nested = defs.some(
    (d) => d.id !== defId && d.circuit.components.some((x) => x.type === "sub" && x.subId === defId),
  );
  if (nested) return { ok: false, reason: "That block is used inside another block." };

  const instances = circuit.components.filter((c) => c.type === "sub" && c.subId === defId);
  for (const inst of instances) removeComponent(circuit, inst.id);
  circuit.subcircuits = defs.filter((d) => d.id !== defId);
  return { ok: true, removedInstances: instances.length };
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
