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
  sublabel?: string; // small second line under the gate label (e.g. "2:1")
  width?: number; // override the default gate body width
  pinLabels?: Record<TerminalId, string>; // short labels drawn beside terminals
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
  nand: {
    label: "NAND",
    category: "gates",
    inputs: ["in0", "in1"],
    outputs: ["out0"],
    evaluate: (i) => ({ out0: (i.in0 && i.in1 ? 0 : 1) as Bit }),
  },
  nor: {
    label: "NOR",
    category: "gates",
    inputs: ["in0", "in1"],
    outputs: ["out0"],
    evaluate: (i) => ({ out0: (i.in0 || i.in1 ? 0 : 1) as Bit }),
  },
  xor: {
    label: "XOR",
    category: "gates",
    inputs: ["in0", "in1"],
    outputs: ["out0"],
    evaluate: (i) => ({ out0: (i.in0 ^ i.in1) as Bit }),
  },
  xnor: {
    label: "XNOR",
    category: "gates",
    inputs: ["in0", "in1"],
    outputs: ["out0"],
    evaluate: (i) => ({ out0: (i.in0 ^ i.in1 ? 0 : 1) as Bit }),
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

  // ---- selectors ----
  mux2: {
    label: "MUX",
    sublabel: "2:1",
    category: "selectors",
    width: 96,
    inputs: ["in0", "in1", "s0"],
    outputs: ["out0"],
    pinLabels: { in0: "0", in1: "1", s0: "sel" },
    evaluate: (i) => ({ out0: i.s0 ? i.in1 : i.in0 }),
  },
  mux4: {
    label: "MUX",
    sublabel: "4:1",
    category: "selectors",
    width: 96,
    inputs: ["in0", "in1", "in2", "in3", "s0", "s1"],
    outputs: ["out0"],
    pinLabels: { s0: "s0", s1: "s1" },
    evaluate: (i) => ({ out0: [i.in0, i.in1, i.in2, i.in3][(i.s1 << 1) | i.s0] as Bit }),
  },

  // ---- arithmetic ----
  halfadder: {
    label: "HA",
    sublabel: "½ add",
    category: "arithmetic",
    width: 100,
    inputs: ["in0", "in1"],
    outputs: ["sum", "carry"],
    pinLabels: { in0: "A", in1: "B", sum: "S", carry: "C" },
    evaluate: (i) => ({ sum: (i.in0 ^ i.in1) as Bit, carry: (i.in0 && i.in1 ? 1 : 0) as Bit }),
  },
  fulladder: {
    label: "FA",
    sublabel: "add",
    category: "arithmetic",
    width: 100,
    inputs: ["in0", "in1", "cin"],
    outputs: ["sum", "carry"],
    pinLabels: { in0: "A", in1: "B", cin: "Cin", sum: "S", carry: "Co" },
    evaluate: (i) => {
      const total = i.in0 + i.in1 + i.cin;
      return { sum: (total & 1) as Bit, carry: (total > 1 ? 1 : 0) as Bit };
    },
  },

  // ---- display (custom renderer; logic is still a registry entry) ----
  sevenseg: {
    label: "7SEG",
    category: "display",
    render: "seven-seg",
    inputs: ["in0", "in1", "in2", "in3"], // BCD/hex, in0 = LSB (weight 1)
    outputs: [],
    pinLabels: { in0: "1", in1: "2", in2: "4", in3: "8" },
    evaluate: () => ({}),
  },
};
