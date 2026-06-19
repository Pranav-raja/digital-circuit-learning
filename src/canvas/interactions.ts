/*
 * canvas/interactions.ts — drag-to-wire, move, toggle, select, delete, pan/zoom
 * (spec §7). Interaction is decided by WHAT you click, never a global mode (rule
 * #3): output terminal → wire, gate body → move, input → toggle, wire/empty →
 * select/deselect. Space-drag or middle-mouse pans; scroll zooms toward the cursor.
 * Listeners are delegated on the single SVG, so they survive full re-renders.
 */

import type { TerminalRef } from "../core/types";
import { wirePath } from "../core/geometry";
import { addWire, moveComponent, toggleInput, removeById } from "../core/model";
import { getState, update, select, checkpoint, undo, redo } from "../store";
import {
  getSvg,
  clientToScreen,
  clientToWorld,
  terminalScreen,
  panBy,
  zoomAt,
} from "./Canvas";

type Drag =
  | { kind: "none" }
  | { kind: "wire"; from: TerminalRef }
  | { kind: "move"; id: string; offX: number; offY: number; moved: boolean; checkpointed: boolean }
  | { kind: "press"; id: string; sx: number; sy: number } // railed part: maybe a toggle click
  | { kind: "pan"; lastX: number; lastY: number };

let drag: Drag = { kind: "none" };
let spaceHeld = false;

const preview = (): SVGPathElement | null => getSvg().querySelector<SVGPathElement>("#wire-preview");

function drawPreview(clientX: number, clientY: number): void {
  const d = drag; // snapshot: narrowing survives the calls below
  if (d.kind !== "wire") return;
  const p = preview();
  const p0 = terminalScreen(d.from);
  if (!p || !p0) return;
  p.setAttribute("d", wirePath(p0, clientToScreen(clientX, clientY)));
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
    // Pan first: middle-mouse, or space + left-drag (rule #3 — a held modifier, not a mode).
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      drag = { kind: "pan", lastX: e.clientX, lastY: e.clientY };
      svg.classList.add("is-panning");
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

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
        const pt = clientToWorld(e.clientX, e.clientY);
        drag = {
          kind: "move",
          id,
          offX: pt.x - comp.x,
          offY: pt.y - comp.y,
          moved: false,
          checkpointed: false,
        };
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
      if (!d.checkpointed) {
        checkpoint(); // one undo entry per drag gesture, captured before the first move
        d.checkpointed = true;
      }
      const pt = clientToWorld(e.clientX, e.clientY);
      update((c) => moveComponent(c, d.id, pt.x - d.offX, pt.y - d.offY));
      d.moved = true;
    } else if (d.kind === "pan") {
      panBy(e.clientX - d.lastX, e.clientY - d.lastY);
      d.lastX = e.clientX;
      d.lastY = e.clientY;
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
        checkpoint();
        const res = update((c) => addWire(c, from, to));
        if (!res.ok) setMessage(res.reason);
      }
      clearPreview();
    } else if (d.kind === "press") {
      const comp = getState().circuit.components.find((c) => c.id === d.id);
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4;
      if (comp?.type === "input" && !moved) {
        checkpoint();
        update((c) => toggleInput(c, d.id));
      }
    } else if (d.kind === "pan") {
      svg.classList.remove("is-panning");
    }
    drag = { kind: "none" };
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  });

  // scroll = zoom toward the cursor (spec §7)
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    },
    { passive: false },
  );

  window.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName ?? "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (e.key === " ") {
      spaceHeld = true;
      svg.classList.add("is-pan-ready");
      if (document.activeElement === document.body) e.preventDefault();
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      const { circuit } = getState();
      select([...circuit.components.map((c) => c.id), ...circuit.wires.map((w) => w.id)]);
      return;
    }

    if (e.key === "Escape") {
      if (drag.kind === "wire") cancelWire();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      const sel = [...getState().selection];
      if (sel.length) {
        e.preventDefault();
        checkpoint();
        update((c) => {
          for (const id of sel) removeById(c, id);
        });
        select([]);
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === " ") {
      spaceHeld = false;
      svg.classList.remove("is-pan-ready");
    }
  });
}
