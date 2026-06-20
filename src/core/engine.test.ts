/*
 * Truth-table tests for the engine (spec §13). This guards the one place a bug
 * is silent and confusing. Built by composing the public model API, so it also
 * exercises addComponent/addWire end to end.
 */

import { describe, it, expect } from "vitest";
import { createCircuit, addComponent, addInput, addOutput, addWire } from "./model";
import { evaluate } from "./engine";
import { REGISTRY } from "./registry";
import type { Bit } from "./types";

/** Run a single gate over its truth table via a tiny ad-hoc circuit. */
function gateOut(type: string, ins: Bit[]): Bit {
  const c = createCircuit();
  const g = addComponent(c, type, 200, 100);
  const def = REGISTRY[type];
  def.inputs.forEach((term, i) => {
    const a = addInput(c);
    a.value = ins[i];
    addWire(c, { comp: a.id, term: "out0" }, { comp: g.id, term });
  });
  return (evaluate(c, REGISTRY).outputs.get(g.id)?.out0 ?? 0) as Bit;
}

describe("primitive gates", () => {
  it("AND", () => {
    expect(gateOut("and", [0, 0])).toBe(0);
    expect(gateOut("and", [0, 1])).toBe(0);
    expect(gateOut("and", [1, 0])).toBe(0);
    expect(gateOut("and", [1, 1])).toBe(1);
  });
  it("OR", () => {
    expect(gateOut("or", [0, 0])).toBe(0);
    expect(gateOut("or", [0, 1])).toBe(1);
    expect(gateOut("or", [1, 0])).toBe(1);
    expect(gateOut("or", [1, 1])).toBe(1);
  });
  it("NOT", () => {
    expect(gateOut("not", [0])).toBe(1);
    expect(gateOut("not", [1])).toBe(0);
  });
});

describe("richer gates (Phase 5)", () => {
  it("NAND / NOR / XOR / XNOR", () => {
    expect([gateOut("nand", [0, 0]), gateOut("nand", [1, 1])]).toEqual([1, 0]);
    expect([gateOut("nor", [0, 0]), gateOut("nor", [1, 0])]).toEqual([1, 0]);
    expect([gateOut("xor", [1, 0]), gateOut("xor", [1, 1])]).toEqual([1, 0]);
    expect([gateOut("xnor", [1, 0]), gateOut("xnor", [1, 1])]).toEqual([0, 1]);
  });
});

/** Drive a multi-input part and read one of its output terminals. */
function partOut(type: string, ins: Record<string, Bit>, outTerm: string): Bit {
  const c = createCircuit();
  const g = addComponent(c, type, 300, 100);
  for (const [term, value] of Object.entries(ins)) {
    const a = addInput(c);
    a.value = value;
    addWire(c, { comp: a.id, term: "out0" }, { comp: g.id, term });
  }
  return (evaluate(c, REGISTRY).outputs.get(g.id)?.[outTerm] ?? 0) as Bit;
}

describe("selectors", () => {
  it("2:1 MUX picks in0/in1 by select", () => {
    expect(partOut("mux2", { in0: 1, in1: 0, s0: 0 }, "out0")).toBe(1);
    expect(partOut("mux2", { in0: 1, in1: 0, s0: 1 }, "out0")).toBe(0);
  });
  it("4:1 MUX picks the selected input", () => {
    expect(partOut("mux4", { in0: 0, in1: 0, in2: 1, in3: 0, s0: 0, s1: 1 }, "out0")).toBe(1);
    expect(partOut("mux4", { in0: 0, in1: 1, in2: 0, in3: 0, s0: 1, s1: 0 }, "out0")).toBe(1);
  });
});

describe("arithmetic parts", () => {
  it("full adder sum + carry over all 8 inputs", () => {
    for (let n = 0; n < 8; n++) {
      const a = (n & 1) as Bit;
      const b = ((n >> 1) & 1) as Bit;
      const cin = ((n >> 2) & 1) as Bit;
      const total = a + b + cin;
      expect(partOut("fulladder", { in0: a, in1: b, cin }, "sum")).toBe((total & 1) as Bit);
      expect(partOut("fulladder", { in0: a, in1: b, cin }, "carry")).toBe((total > 1 ? 1 : 0) as Bit);
    }
  });
  it("half adder sum + carry", () => {
    expect(partOut("halfadder", { in0: 1, in1: 1 }, "carry")).toBe(1);
    expect(partOut("halfadder", { in0: 1, in1: 1 }, "sum")).toBe(0);
    expect(partOut("halfadder", { in0: 1, in1: 0 }, "sum")).toBe(1);
  });
});

describe("wiring semantics", () => {
  it("an unconnected input defaults to 0", () => {
    const c = createCircuit();
    const g = addComponent(c, "and", 200, 100);
    const a = addInput(c);
    a.value = 1;
    addWire(c, { comp: a.id, term: "out0" }, { comp: g.id, term: "in0" }); // in1 left open
    expect(evaluate(c, REGISTRY).outputs.get(g.id)?.out0).toBe(0);
  });

  it("an output fans out to many inputs", () => {
    const c = createCircuit();
    const a = addInput(c);
    a.value = 1;
    const n1 = addComponent(c, "not", 200, 100);
    const n2 = addComponent(c, "not", 200, 200);
    addWire(c, { comp: a.id, term: "out0" }, { comp: n1.id, term: "in0" });
    addWire(c, { comp: a.id, term: "out0" }, { comp: n2.id, term: "in0" });
    const r = evaluate(c, REGISTRY);
    expect(r.outputs.get(n1.id)?.out0).toBe(0);
    expect(r.outputs.get(n2.id)?.out0).toBe(0);
  });

  it("an input accepts only one wire (last wins)", () => {
    const c = createCircuit();
    const a = addInput(c);
    const b = addInput(c);
    a.value = 1;
    b.value = 0;
    const not = addComponent(c, "not", 200, 100);
    addWire(c, { comp: a.id, term: "out0" }, { comp: not.id, term: "in0" });
    addWire(c, { comp: b.id, term: "out0" }, { comp: not.id, term: "in0" }); // replaces a→not
    expect(c.wires.length).toBe(1);
    expect(evaluate(c, REGISTRY).outputs.get(not.id)?.out0).toBe(1); // NOT(0) = 1
  });
});

describe("half adder built from AND/OR/NOT", () => {
  // sum = a XOR b = (a OR b) AND NOT(a AND b);  carry = a AND b
  function halfAdder(a: Bit, b: Bit): { sum: Bit; carry: Bit } {
    const c = createCircuit();
    const A = addInput(c);
    const B = addInput(c);
    A.value = a;
    B.value = b;
    const and1 = addComponent(c, "and", 300, 80); // a & b  → carry
    const or1 = addComponent(c, "or", 300, 200); // a | b
    const not1 = addComponent(c, "not", 460, 80); // !(a & b)
    const and2 = addComponent(c, "and", 600, 200); // (a|b) & !(a&b) → sum
    const SUM = addOutput(c);
    const CARRY = addOutput(c);

    const out = (id: string) => ({ comp: id, term: "out0" });
    addWire(c, out(A.id), { comp: and1.id, term: "in0" });
    addWire(c, out(B.id), { comp: and1.id, term: "in1" });
    addWire(c, out(A.id), { comp: or1.id, term: "in0" });
    addWire(c, out(B.id), { comp: or1.id, term: "in1" });
    addWire(c, out(and1.id), { comp: not1.id, term: "in0" });
    addWire(c, out(or1.id), { comp: and2.id, term: "in0" });
    addWire(c, out(not1.id), { comp: and2.id, term: "in1" });
    addWire(c, out(and2.id), { comp: SUM.id, term: "in0" });
    addWire(c, out(and1.id), { comp: CARRY.id, term: "in0" });

    const r = evaluate(c, REGISTRY);
    return {
      sum: (r.inputsOf.get(SUM.id)?.in0 ?? 0) as Bit,
      carry: (r.inputsOf.get(CARRY.id)?.in0 ?? 0) as Bit,
    };
  }

  it("matches the truth table", () => {
    expect(halfAdder(0, 0)).toEqual({ sum: 0, carry: 0 });
    expect(halfAdder(0, 1)).toEqual({ sum: 1, carry: 0 });
    expect(halfAdder(1, 0)).toEqual({ sum: 1, carry: 0 });
    expect(halfAdder(1, 1)).toEqual({ sum: 0, carry: 1 });
  });
});

describe("cycle handling (ADR-005)", () => {
  it("flags the cyclic wires and returns instead of hanging", () => {
    const c = createCircuit();
    const n1 = addComponent(c, "not", 200, 100);
    const n2 = addComponent(c, "not", 400, 100);
    addWire(c, { comp: n1.id, term: "out0" }, { comp: n2.id, term: "in0" });
    addWire(c, { comp: n2.id, term: "out0" }, { comp: n1.id, term: "in0" });
    const r = evaluate(c, REGISTRY);
    expect(r.errors.cycleWireIds.length).toBe(2);
  });
});
