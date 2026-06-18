/*
 * core/registry.ts — the static component-type registry (spec §8, architecture §3).
 * The single home of type knowledge. Adding a standard gate is one entry here;
 * rendering and simulation stay generic. Never saved — this is code, not data.
 */

import type { Bit, Category, TerminalId } from "./types";

/** Values handed to evaluate(): every declared input, defaulted to 0 by the engine. */
export type Inputs = Record<TerminalId, Bit>;
export type Outputs = Record<TerminalId, Bit>;

/** How the canvas should draw this part. Standard gates use "gate". */
export type RenderKind = "gate" | "toggle" | "led" | "seven-seg" | "transistor" | "block";

export interface ComponentDef {
  label: string;
  category: Category;
  inputs: TerminalId[]; // left face, top → bottom
  outputs: TerminalId[]; // right face, top → bottom
  /** Pure logic. The engine guarantees every input key is present (default 0). */
  evaluate: (inputs: Inputs) => Outputs;
  render?: RenderKind; // default "gate"
  /** When true the output IS the instance's `value` (an input toggle) — the
   * engine special-cases these rather than calling evaluate (architecture §4). */
  source?: boolean;
}

export type Registry = Record<string, ComponentDef>;

const and2 = (i: Inputs): Outputs => ({ out0: (i.in0 && i.in1 ? 1 : 0) as Bit });
const or2 = (i: Inputs): Outputs => ({ out0: (i.in0 || i.in1 ? 1 : 0) as Bit });

/** The Phase 1 kit. Richer parts (XOR/MUX/adders/displays) arrive in Phase 5. */
export const REGISTRY: Registry = {
  and: {
    label: "AND",
    category: "gates",
    inputs: ["in0", "in1"],
    outputs: ["out0"],
    evaluate: and2,
  },
  or: {
    label: "OR",
    category: "gates",
    inputs: ["in0", "in1"],
    outputs: ["out0"],
    evaluate: or2,
  },
  not: {
    label: "NOT",
    category: "gates",
    inputs: ["in0"],
    outputs: ["out0"],
    evaluate: (i) => ({ out0: i.in0 ? 0 : 1 }),
  },
  input: {
    label: "IN",
    category: "io",
    render: "toggle",
    source: true,
    inputs: [],
    outputs: ["out0"],
    evaluate: () => ({ out0: 0 }), // never called; output comes from instance.value
  },
  output: {
    label: "OUT",
    category: "io",
    render: "led",
    inputs: ["in0"],
    outputs: [],
    evaluate: () => ({}),
  },
};
