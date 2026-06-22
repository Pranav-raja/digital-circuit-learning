/*
 * canvas/interactions.ts — drag-to-wire, move, toggle, select, delete, pan/zoom
 * (spec §7). Interaction is decided by WHAT you click, never a global mode (rule
 * #3): output terminal → wire, gate body → move, input → toggle, wire/empty →
 * select/deselect. Dragging empty space pans (mouse, pen, or finger); a tap there
 * deselects. Wheel / two-finger trackpad scroll pans; ctrl/⌘+wheel and trackpad
 * pinch zoom; two-finger touch pinches. One pointer-event code path serves mouse,
 * pen, and touch. Listeners are delegated on the SVG, surviving full re-renders.
 */

import type { TerminalRef } from "../core/types";
import { wirePath } from "../core/geometry";
import { addWire, moveComponent, toggleInput, removeById } from "../core/model";
import { getState, update, select, toggleSelect, checkpoint, undo, redo } from "../store";
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
  | { kind: "pan"; lastX: number; lastY: number; sx: number; sy: number; deselectOnTap: boolean };

let drag: Drag = { kind: "none" };
let spaceHeld = false;

const TAP_SLOP = 6; // px of movement still counted as a tap (finger jitter)

// Active pointers, for multi-touch. Two down → pinch-zoom + two-finger pan.
type Vec = { x: number; y: number };
const pointers = new Map<number, Vec>();
let pinch: { dist: number; cx: number; cy: number } | null = null;

const twoPointers = (): [Vec, Vec] => {
  const p = [...pointers.values()];
  return [p[0], p[1]];
};
const spanOf = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
const midOf = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

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
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Second finger down → switch to a pinch gesture; abandon any single-finger drag.
    if (pointers.size === 2) {
      if (drag.kind === "wire") clearPreview();
      drag = { kind: "none" };
      const [a, b] = twoPointers();
      const m = midOf(a, b);
      pinch = { dist: spanOf(a, b), cx: m.x, cy: m.y };
      return;
    }
    if (pointers.size > 2) return;

    // Pan first: middle-mouse, or space + left-drag (rule #3 — a held modifier, not a mode).
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      drag = {
        kind: "pan",
        lastX: e.clientX,
        lastY: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        deselectOnTap: false,
      };
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
      if (e.shiftKey) {
        toggleSelect(id); // add/remove from the multi-selection (for grouping)
        return;
      }
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

    // Empty canvas: drag to pan; a tap (no drag) deselects on release.
    drag = {
      kind: "pan",
      lastX: e.clientX,
      lastY: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      deselectOnTap: true,
    };
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = twoPointers();
      const m = midOf(a, b);
      const span = spanOf(a, b);
      const ratio = pinch.dist > 0 ? span / pinch.dist : 1;
      if (Math.abs(ratio - 1) > 0.01) zoomAt(m.x, m.y, ratio); // pinch (deadzoned) → zoom
      panBy(m.x - pinch.cx, m.y - pinch.cy); // two-finger drag → pan
      pinch = { dist: span, cx: m.x, cy: m.y };
      return;
    }
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
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > TAP_SLOP) svg.classList.add("is-panning");
      panBy(e.clientX - d.lastX, e.clientY - d.lastY);
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    }
  });

  svg.addEventListener("pointerup", (e) => {
    pointers.delete(e.pointerId);
    if (pinch && pointers.size < 2) pinch = null;
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
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > TAP_SLOP;
      if (comp?.type === "input" && !moved) {
        checkpoint();
        update((c) => toggleInput(c, d.id));
      }
    } else if (d.kind === "pan") {
      svg.classList.remove("is-panning");
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > TAP_SLOP;
      if (d.deselectOnTap && !moved) select([]); // it was a tap on empty space
    }
    drag = { kind: "none" };
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  });

  // touch interrupted (e.g. a system gesture) — clean up so nothing gets stuck.
  svg.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag.kind === "wire") clearPreview();
    if (drag.kind === "pan") svg.classList.remove("is-panning");
    drag = { kind: "none" };
  });

  // Wheel / two-finger trackpad scroll → pan. Trackpad pinch arrives as ctrl+wheel
  // (and Ctrl/⌘+wheel works on a mouse) → zoom toward the cursor.
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.002));
      else panBy(-e.deltaX, -e.deltaY);
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
