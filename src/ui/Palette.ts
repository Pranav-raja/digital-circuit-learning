/*
 * ui/Palette.ts — the browsable component library (spec §6).
 * Phase 1: click a part to drop it. Gates land at the viewport center; inputs
 * and outputs append to their rails. Drag-from-palette is a Phase 4 nicety.
 * Any element with [data-type] is a live part; "soon" chips have no data-type.
 */

import { REGISTRY } from "../core/registry";
import { sizeOf } from "../core/geometry";
import { addComponent, addInput, addOutput } from "../core/model";
import { update } from "../store";
import { centerPoint } from "../canvas/Canvas";

function addPart(type: string): void {
  if (type === "input") {
    update((c) => addInput(c));
    return;
  }
  if (type === "output") {
    update((c) => addOutput(c));
    return;
  }
  const def = REGISTRY[type];
  if (!def) return;
  const { w, h } = sizeOf(def);
  const ctr = centerPoint();
  update((c) => addComponent(c, type, ctr.x - w / 2, ctr.y - h / 2));
}

/** Wire every [data-type] affordance (palette chips + rail "+ Add" buttons). */
export function initPalette(): void {
  document.querySelectorAll<HTMLElement>("[data-type]").forEach((el) => {
    el.addEventListener("click", () => addPart(el.dataset.type!));
  });
}
