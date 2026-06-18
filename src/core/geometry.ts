/*
 * core/geometry.ts — pure geometry (architecture §6). No DOM. Shared by the
 * canvas renderer and the interaction layer so wire math lives in one place.
 */

import type { ComponentInstance, TerminalId } from "./types";
import type { ComponentDef } from "./registry";

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  w: number;
  h: number;
}

export const GRID = 24; // the 24px canvas grid (spec §5)

/** Snap a coordinate to the canvas grid. */
export const snap = (v: number): number => Math.round(v / GRID) * GRID;

/** Body size of a component, derived from its render kind + pin count. */
export function sizeOf(def: ComponentDef): Box {
  switch (def.render) {
    case "toggle":
    case "led":
      return { w: 100, h: 36 };
    default: {
      // gate / block: tall enough for the busier face, on a 24px rhythm.
      const rows = Math.max(def.inputs.length, def.outputs.length, 1);
      return { w: 72, h: Math.max(48, rows * 24 + 24) };
    }
  }
}

/** Evenly spaced position of a pin along a face of height `h`. */
const faceY = (h: number, n: number, i: number): number => (h * (i + 1)) / (n + 1);

/** Absolute position of a terminal in canvas (model) coordinates. */
export function terminalPos(comp: ComponentInstance, def: ComponentDef, term: TerminalId): Pt {
  const { w, h } = sizeOf(def);
  const inIdx = def.inputs.indexOf(term);
  if (inIdx >= 0) {
    return { x: comp.x, y: comp.y + faceY(h, def.inputs.length, inIdx) };
  }
  const outIdx = def.outputs.indexOf(term);
  return { x: comp.x + w, y: comp.y + faceY(h, Math.max(def.outputs.length, 1), outIdx) };
}

/**
 * Cubic Bézier from output P0 to input P3 (spec §7). Control points are pushed
 * horizontally by k so the wire reads as a smooth left-to-right circuit trace.
 */
export function wirePath(p0: Pt, p3: Pt): string {
  const k = Math.min(Math.max(Math.abs(p3.x - p0.x) * 0.5, 40), 160);
  return `M ${p0.x} ${p0.y} C ${p0.x + k} ${p0.y}, ${p3.x - k} ${p3.y}, ${p3.x} ${p3.y}`;
}
