/*
 * canvas/Canvas.ts — renders the board to SVG (architecture §1, spec §4).
 * One SVG in model coordinates (1 unit = 1px in Phase 1; pan/zoom is a single
 * transform added in Phase 4). Input components auto-dock to the left rail,
 * outputs to the right, gates float on the grid. Re-renders on every store change;
 * interactions.ts attaches delegated listeners to the same SVG.
 */

import type { Circuit, ComponentInstance, TerminalRef } from "../core/types";
import { REGISTRY, type ComponentDef } from "../core/registry";
import { sizeOf, terminalPos, wirePath, type Pt } from "../core/geometry";
import { getState, subscribe } from "../store";

const SVG_NS = "http://www.w3.org/2000/svg";
const RAIL_PAD = 16;
const RAIL_TOP = 64;
const RAIL_ROW = 52;

let svg: SVGSVGElement;
let emptyEl: HTMLElement | null;

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

// ---- public API ------------------------------------------------------------
export function mountCanvas(container: HTMLElement): void {
  svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("canvas");
  container.appendChild(svg);
  emptyEl = container.querySelector(".empty-state");

  new ResizeObserver(render).observe(svg);
  subscribe(render);
  render();
}

export const getSvg = (): SVGSVGElement => svg;

/** Screen (client) point → model coordinates. Identity offset in Phase 1. */
export function clientToModel(clientX: number, clientY: number): Pt {
  const r = svg.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}

/** Model coordinates of the board's visual center (for "drop at center"). */
export function centerPoint(): Pt {
  const r = svg.getBoundingClientRect();
  return { x: r.width / 2, y: r.height / 2 };
}

// ---- layout ----------------------------------------------------------------
/** Dock inputs to the left rail and outputs to the right; gates keep their x,y. */
function layoutRails(circuit: Circuit, boardW: number): void {
  const outW = sizeOf(REGISTRY.output).w;
  let nIn = 0;
  let nOut = 0;
  for (const c of circuit.components) {
    if (c.type === "input") {
      c.x = RAIL_PAD;
      c.y = RAIL_TOP + nIn++ * RAIL_ROW;
    } else if (c.type === "output") {
      c.x = Math.max(boardW - RAIL_PAD - outW, 240);
      c.y = RAIL_TOP + nOut++ * RAIL_ROW;
    }
  }
}

// ---- rendering -------------------------------------------------------------
const termPos = (circuit: Circuit, ref: TerminalRef): Pt | null => {
  const c = circuit.components.find((x) => x.id === ref.comp);
  const def = c && REGISTRY[c.type];
  return c && def ? terminalPos(c, def, ref.term) : null;
};

function termCircle(
  c: ComponentInstance,
  def: ComponentDef,
  term: string,
  dir: "in" | "out",
  high: boolean,
): string {
  const p = terminalPos(c, def, term);
  return `<circle class="term term--${dir}${high ? " is-high" : ""}" data-comp="${c.id}" data-term="${term}" data-dir="${dir}" cx="${p.x}" cy="${p.y}" r="6" />`;
}

function renderComponent(
  c: ComponentInstance,
  def: ComponentDef,
  selected: boolean,
  outVals: Record<string, number>,
  inVals: Record<string, number>,
): string {
  const { w, h } = sizeOf(def);
  const head = `<g class="comp${selected ? " is-selected" : ""}" data-id="${c.id}">`;

  if (def.render === "toggle") {
    const on = c.value === 1;
    return `${head}
      <rect class="io-body" x="${c.x}" y="${c.y}" width="${w}" height="${h}" rx="8" />
      <text class="io-label" x="${c.x + 14}" y="${c.y + h / 2}">${esc(c.label ?? "")}</text>
      <rect class="val-chip${on ? " is-on" : ""}" x="${c.x + 56}" y="${c.y + 8}" width="30" height="20" rx="4" />
      <text class="val-text${on ? " is-on" : ""}" x="${c.x + 71}" y="${c.y + h / 2}">${on ? 1 : 0}</text>
      ${termCircle(c, def, "out0", "out", on)}
    </g>`;
  }

  if (def.render === "led") {
    const on = inVals.in0 === 1;
    return `${head}
      ${termCircle(c, def, "in0", "in", on)}
      <rect class="io-body" x="${c.x}" y="${c.y}" width="${w}" height="${h}" rx="8" />
      <circle class="led-lamp${on ? " is-on" : ""}" cx="${c.x + 26}" cy="${c.y + h / 2}" r="9" />
      <text class="io-label" x="${c.x + 44}" y="${c.y + h / 2}">${esc(c.label ?? "OUT")}</text>
    </g>`;
  }

  // gate / block
  const terms =
    def.inputs.map((t) => termCircle(c, def, t, "in", false)).join("") +
    def.outputs.map((t) => termCircle(c, def, t, "out", outVals[t] === 1)).join("");
  return `${head}
    <rect class="gate-body" x="${c.x}" y="${c.y}" width="${w}" height="${h}" />
    <text class="gate-label" x="${c.x + w / 2}" y="${c.y + h / 2}">${esc(def.label)}</text>
    ${terms}
  </g>`;
}

function render(): void {
  const { circuit, sim, selection } = getState();
  const boardW = svg.clientWidth || 960;
  layoutRails(circuit, boardW);

  const wires = circuit.wires
    .map((w) => {
      const p0 = termPos(circuit, w.from);
      const p3 = termPos(circuit, w.to);
      if (!p0 || !p3) return "";
      const cls = [
        "wire",
        sim.wireValues.get(w.id) === 1 ? "is-high" : "",
        sim.errors.cycleWireIds.includes(w.id) ? "is-cycle" : "",
        selection.has(w.id) ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<path class="${cls}" data-id="${w.id}" d="${wirePath(p0, p3)}" />`;
    })
    .join("");

  const comps = circuit.components
    .map((c) => {
      const def = REGISTRY[c.type];
      if (!def) return "";
      return renderComponent(
        c,
        def,
        selection.has(c.id),
        sim.outputs.get(c.id) ?? {},
        sim.inputsOf.get(c.id) ?? {},
      );
    })
    .join("");

  svg.innerHTML = `${wires}${comps}<path id="wire-preview" class="wire wire--preview" d="" />`;
  if (emptyEl) emptyEl.style.display = circuit.components.length ? "none" : "";
}
