/*
 * Model + persistence-shape tests (architecture §8). Pure: no DOM, no localStorage.
 * Guards the save/load round-trip and the wiring rules that the UI relies on.
 */

import { describe, it, expect } from "vitest";
import {
  createCircuit,
  addComponent,
  addInput,
  addOutput,
  addWire,
  removeComponent,
  groupSelection,
  deleteSubcircuit,
  validateCircuit,
} from "./model";
import { SCHEMA_VERSION } from "./types";

/** Build a tiny block (NOT gate wrapped) and return its def id. */
function makeBlock(c: ReturnType<typeof createCircuit>, name: string): string {
  const a = addInput(c);
  const g = addComponent(c, "not", 200, 100);
  const o = addOutput(c);
  addWire(c, { comp: a.id, term: "out0" }, { comp: g.id, term: "in0" });
  addWire(c, { comp: g.id, term: "out0" }, { comp: o.id, term: "in0" });
  const res = groupSelection(c, [a.id, g.id, o.id], name);
  if (!res.ok) throw new Error("group failed");
  return c.subcircuits!.find((d) => d.name === name)!.id;
}

describe("save/load round-trip", () => {
  it("survives JSON.stringify → parse → validate unchanged", () => {
    const c = createCircuit("Demo");
    const a = addInput(c);
    const g = addComponent(c, "not", 200, 100);
    const o = addOutput(c);
    addWire(c, { comp: a.id, term: "out0" }, { comp: g.id, term: "in0" });
    addWire(c, { comp: g.id, term: "out0" }, { comp: o.id, term: "in0" });

    const res = validateCircuit(JSON.parse(JSON.stringify(c)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.circuit).toEqual(c);
  });
});

describe("validateCircuit", () => {
  it("accepts a well-formed circuit", () => {
    expect(validateCircuit(createCircuit()).ok).toBe(true);
  });
  it("rejects non-objects and corrupt shapes", () => {
    expect(validateCircuit(null).ok).toBe(false);
    expect(validateCircuit("nope").ok).toBe(false);
    expect(validateCircuit({ version: 1 }).ok).toBe(false); // missing arrays
  });
  it("rejects a newer schema version with a clear message", () => {
    const future = { ...createCircuit(), version: SCHEMA_VERSION + 1 };
    const res = validateCircuit(future);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/newer version/i);
  });
});

describe("deleting blocks (Phase 6)", () => {
  it("removes the block and its instances on the board", () => {
    const c = createCircuit();
    const id = makeBlock(c, "Inv"); // grouping leaves one instance on the board
    expect(c.components.filter((x) => x.subId === id).length).toBe(1);
    const res = deleteSubcircuit(c, id);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.removedInstances).toBe(1);
    expect(c.subcircuits!.some((d) => d.id === id)).toBe(false);
    expect(c.components.some((x) => x.subId === id)).toBe(false);
  });

  it("refuses to delete a block nested inside another block", () => {
    const c = createCircuit();
    const innerId = makeBlock(c, "Inner"); // one Inner instance on the board
    // wrap that instance into an outer block → Outer's def contains an Inner instance
    const inst = c.components.find((x) => x.subId === innerId)!;
    const res = groupSelection(c, [inst.id], "Outer");
    expect(res.ok).toBe(true);
    const del = deleteSubcircuit(c, innerId);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.reason).toMatch(/inside another block/i);
  });
});

describe("wiring rules (§7)", () => {
  it("enforces output → input orientation, but allows self-feedback", () => {
    const c = createCircuit();
    const g1 = addComponent(c, "and", 100, 100);
    const g2 = addComponent(c, "and", 300, 100);
    // input → input is illegal
    expect(addWire(c, { comp: g1.id, term: "in0" }, { comp: g2.id, term: "in0" }).ok).toBe(false);
    // output → input on the same part is allowed (e.g. a flip-flop's Q' → D)
    expect(addWire(c, { comp: g1.id, term: "out0" }, { comp: g1.id, term: "in0" }).ok).toBe(true);
  });

  it("removing a component also removes its attached wires", () => {
    const c = createCircuit();
    const a = addInput(c);
    const g = addComponent(c, "not", 200, 100);
    addWire(c, { comp: a.id, term: "out0" }, { comp: g.id, term: "in0" });
    expect(c.wires.length).toBe(1);
    removeComponent(c, g.id);
    expect(c.wires.length).toBe(0);
  });
});
