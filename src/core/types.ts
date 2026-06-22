/*
 * core/types.ts — the data model (spec §8, architecture §2).
 * These shapes ARE the save file. Pure data, no behavior. The brain (core/)
 * imports nothing from the body (ui/canvas/storage) — ADR-004.
 */

/** A logic value. Two states only in v1 — no tri-state / high-Z. */
export type Bit = 0 | 1;

/** Terminal handle within a component, e.g. "in0", "out0". */
export type TerminalId = string;

/** Category keys drive palette grouping (spec §6; +sequential, Phase 6). */
export type Category =
  | "gates"
  | "io"
  | "display"
  | "arithmetic"
  | "selectors"
  | "sequential"
  | "atoms";

/** A placed component — pure data, part of the save file. */
export interface ComponentInstance {
  id: string; // unique within the circuit, e.g. "c1"
  type: string; // key into REGISTRY, or "sub" for a subcircuit block
  x: number; // canvas coords, snapped to the 24px grid (gates only; rails auto-dock)
  y: number;
  label?: string; // inputs / outputs / displays show this
  value?: Bit; // ONLY meaningful for input components (the toggle state)
  subId?: string; // for type "sub": which SubcircuitDef this block instances
  params?: Record<string, number>; // future: bit width for n-bit parts, etc.
}

/** Reference to one terminal of one component. */
export interface TerminalRef {
  comp: string; // ComponentInstance.id
  term: TerminalId;
}

/** Directed edge: an output terminal → an input terminal. */
export interface Wire {
  id: string;
  from: TerminalRef; // MUST be an output terminal (validated by the model)
  to: TerminalRef; // MUST be an input terminal; one wire per input (last wins)
}

/** A whole circuit. THIS OBJECT IS THE SAVE FILE (spec §8, §10). */
export interface Circuit {
  version: number; // schema version; bump on a breaking change
  name: string;
  updatedAt: string; // ISO 8601
  components: ComponentInstance[];
  wires: Wire[];
  subcircuits?: SubcircuitDef[]; // user-defined reusable blocks (Phase 6)
}

/** One pin of a block, mapping a position to an internal input/output component. */
export interface SubcircuitPort {
  id: string; // internal component id this pin maps to
  label: string; // shown on the block's pin (e.g. A, SUM)
}

/** A reusable block: a captured circuit plus its external interface (Phase 6). */
export interface SubcircuitDef {
  id: string;
  name: string;
  circuit: Circuit; // the captured internals (the top-level subcircuits library is shared)
  inputs: SubcircuitPort[]; // internal input components, in pin order → in0, in1, …
  outputs: SubcircuitPort[]; // internal output components, in pin order → out0, out1, …
}

export const SCHEMA_VERSION = 1;
