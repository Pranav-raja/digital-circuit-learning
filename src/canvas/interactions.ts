/*
 * canvas/interactions.ts — drag-to-wire, move, toggle, select, delete (spec §7).
 * Interaction is decided by WHAT you click, never a global mode (rule #3):
 *   • press an output terminal → draw a wire (live Bézier preview)
 *   • press a gate body         → move it (connected wires follow)
 *   • click an input toggle      → flip its value
 *   • click a wire / empty       → select / deselect
 * Listeners are delegated on the single SVG, so they survive full re-renders.
 */

import type { TerminalRef } from "../core/types";
import { REGISTRY } from "../core/registry";
import { terminalPos, wirePath } from "../core/geometry";
import { addWire, moveComponent, toggleInput, removeById } from "../core/model";
import { getState, update, select } from "../store";
import { getSvg, clientToModel } from "./Canvas";

type Drag =
  | { kind: "none" }
  | { kind: "wire"; from: TerminalRef }
  | { kind: "move"; id: string; offX: number; offY: number; moved: boolean }
  | { kind: "press"; id: string; sx: number; sy: number }; // railed part: maybe a toggle click

let drag: Drag = { kind: "none" };

const preview = (): SVGPathElement | null =>
  getSvg().querySelector<SVGPathElement>("#wire-preview");

function drawPreview(clientX: number, clientY: number): void {
  const d = drag; // snapshot: narrowing survives the calls below
  if (d.kind !== "wire") return;
  const p = preview();
  const comp = getState().circuit.components.find((c) => c.id === d.from.comp);
  const def = comp && REGISTRY[comp.type];
  if (!p || !comp || !def) return;
  const p0 = terminalPos(comp, def, d.from.term);
  const pt = clientToModel(clientX, clientY);
  p.setAttribute("d", wirePath(p0, pt));
}

function clearPreview(): void {
  preview()?.setAttribute("d", "");
  getSvg().classList.remove("is-wiring");
}

function cancelWire(): void {
  drag = { kind: "none" };
  clearPreview();
}

export function initInteractions(setMessage: (msg: string) => void = () => {}): void {
  const svg = getSvg();

  svg.addEventListener("pointerdown", (e) => {
    const t = e.target as Element;

    const term = t.closest<SVGElement>(".term");
    if (term?.dataset.dir === "out") {
      drag = { kind: "wire", from: { comp: term.dataset.comp!, term: term.dataset.term! } };
      svg.classList.add("is-wiring");
      svg.setPointerCapture(e.pointerId);
      drawPreview(e.clientX, e.clientY);
      return;
    }
    if (term) return; // pressing an input terminal does nothing (wires start at outputs)

    const g = t.closest<SVGElement>(".comp");
    if (g) {
      const id = g.dataset.id!;
      const comp = getState().circuit.components.find((c) => c.id === id);
      if (!comp) return;
      select([id]);
      if (comp.type === "input" || comp.type === "output") {
        drag = { kind: "press", id, sx: e.clientX, sy: e.clientY }; // railed: don't free-move
      } else {
        const pt = clientToModel(e.clientX, e.clientY);
        drag = { kind: "move", id, offX: pt.x - comp.x, offY: pt.y - comp.y, moved: false };
        svg.setPointerCapture(e.pointerId);
      }
      return;
    }

    const wireEl = t.closest<SVGElement>(".wire");
    if (wireEl && wireEl.id !== "wire-preview") {
      select([wireEl.dataset.id!]);
      return;
    }

    select([]); // clicked empty canvas
  });

  svg.addEventListener("pointermove", (e) => {
    const d = drag;
    if (d.kind === "wire") {
      drawPreview(e.clientX, e.clientY);
    } else if (d.kind === "move") {
      const pt = clientToModel(e.clientX, e.clientY);
      update((c) => moveComponent(c, d.id, pt.x - d.offX, pt.y - d.offY));
      d.moved = true;
    }
  });

  svg.addEventListener("pointerup", (e) => {
    const d = drag;
    if (d.kind === "wire") {
      const from = d.from;
      // Find the input terminal under the release point (preview is pointer-transparent).
      const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
      const target = el?.closest<SVGElement>(".term");
      if (target?.dataset.dir === "in") {
        const to: TerminalRef = { comp: target.dataset.comp!, term: target.dataset.term! };
        const res = update((c) => addWire(c, from, to));
        if (!res.ok) setMessage(res.reason);
      }
      clearPreview();
    } else if (d.kind === "press") {
      const comp = getState().circuit.components.find((c) => c.id === d.id);
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4;
      if (comp?.type === "input" && !moved) update((c) => toggleInput(c, d.id));
    }
    drag = { kind: "none" };
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  });

  window.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName ?? "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (e.key === "Escape") {
      if (drag.kind === "wire") cancelWire();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      const sel = [...getState().selection];
      if (sel.length) {
        e.preventDefault();
        update((c) => {
          for (const id of sel) removeById(c, id);
        });
        select([]);
      }
    }
  });
}
