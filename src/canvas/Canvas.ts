/*
 * canvas/Canvas.ts — renders the board to SVG (architecture §1, spec §4).
 * Phase 4 adds a viewport: gates + wires live in a pan/zoom WORLD layer; inputs
 * and outputs stay PINNED to their screen-space rails (spec §4 UX note). Wires are
 * drawn in screen space so they bridge the two cleanly. HIGH wires carry a slow
 * traveling pulse — the signature "signal is the star" element (spec §5).
 */

import type { Circuit, ComponentInstance, TerminalRef } from "../core/types";
import { REGISTRY, type ComponentDef } from "../core/registry";
import { sizeOf, terminalPos, wirePath, type Pt } from "../core/geometry";
import { getState, subscribe } from "../store";

const SVG_NS = "http://www.w3.org/2000/svg";
const RAIL_PAD = 16;
const RAIL_TOP = 64;
const RAIL_ROW = 52;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;

interface View {
  panX: number;
  panY: number;
  zoom: number;
}

let svg: SVGSVGElement;
let centerEl: HTMLElement | null;
let emptyEl: HTMLElement | null;
let view: View = { panX: 0, panY: 0, zoom: 1 };
let viewListener: (zoom: number) => void = () => {};

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const isPinned = (c: ComponentInstance): boolean => c.type === "input" || c.type === "output";

// ---- public API ------------------------------------------------------------
export function mountCanvas(container: HTMLElement): void {
  svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("canvas");
  container.appendChild(svg);
  centerEl = container.querySelector(".board-center");
  emptyEl = container.querySelector(".empty-state");

  new ResizeObserver(render).observe(svg);
  subscribe(render);
  render();
}

export const getSvg = (): SVGSVGElement => svg;
export const getZoom = (): number => view.zoom;

/** Register a callback fired whenever the zoom changes (drives the status bar). */
export function setViewListener(fn: (zoom: number) => void): void {
  viewListener = fn;
  fn(view.zoom);
}

// ---- coordinate transforms -------------------------------------------------
const toScreen = (p: Pt): Pt => ({ x: view.panX + p.x * view.zoom, y: view.panY + p.y * view.zoom });

export function clientToScreen(clientX: number, clientY: number): Pt {
  const r = svg.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}
export function clientToWorld(clientX: number, clientY: number): Pt {
  const s = clientToScreen(clientX, clientY);
  return { x: (s.x - view.panX) / view.zoom, y: (s.y - view.panY) / view.zoom };
}
/** World point at the viewport center — where "drop at center" lands a gate. */
export function centerWorld(): Pt {
  const r = svg.getBoundingClientRect();
  return clientToWorld(r.left + r.width / 2, r.top + r.height / 2);
}

/** Screen position of a terminal — pinned parts as-is, world parts transformed. */
export function terminalScreen(ref: TerminalRef): Pt | null {
  const c = getState().circuit.components.find((x) => x.id === ref.comp);
  const def = c && REGISTRY[c.type];
  if (!c || !def) return null;
  const local = terminalPos(c, def, ref.term);
  return isPinned(c) ? local : toScreen(local);
}

// ---- pan / zoom / fit ------------------------------------------------------
function commitView(): void {
  render();
  viewListener(view.zoom);
}

export function panBy(dx: number, dy: number): void {
  view.panX += dx;
  view.panY += dy;
  commitView();
}

export function zoomAt(clientX: number, clientY: number, factor: number): void {
  const before = clientToWorld(clientX, clientY);
  view.zoom = clamp(view.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  const s = clientToScreen(clientX, clientY);
  view.panX = s.x - before.x * view.zoom;
  view.panY = s.y - before.y * view.zoom;
  commitView();
}

/** Frame all gates in the viewport (spec §7 "fit to content"). */
export function fitToContent(): void {
  const gates = getState().circuit.components.filter((c) => !isPinned(c) && REGISTRY[c.type]);
  const r = svg.getBoundingClientRect();
  if (!gates.length) {
    view = { panX: 0, panY: 0, zoom: 1 };
    commitView();
    return;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of gates) {
    const { w, h } = sizeOf(REGISTRY[c.type]);
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + w);
    maxY = Math.max(maxY, c.y + h);
  }
  const pad = 100;
  const zoom = clamp(
    Math.min(r.width / (maxX - minX + pad), r.height / (maxY - minY + pad)),
    ZOOM_MIN,
    ZOOM_MAX,
  );
  view.zoom = zoom;
  view.panX = r.width / 2 - ((minX + maxX) / 2) * zoom;
  view.panY = r.height / 2 - ((minY + maxY) / 2) * zoom;
  commitView();
}

// ---- layout ----------------------------------------------------------------
/** Dock inputs to the left rail and outputs to the right (screen space, pinned). */
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

// which of the 7 segments (a–g) light for each hex digit 0–F
const SEG: Record<number, string> = {
  0: "abcdef",
  1: "bc",
  2: "abdeg",
  3: "abcdg",
  4: "bcfg",
  5: "acdfg",
  6: "acdefg",
  7: "abc",
  8: "abcdefg",
  9: "abcdfg",
  10: "abcefg",
  11: "cdefg",
  12: "adef",
  13: "bcdeg",
  14: "adefg",
  15: "aefg",
};

/** Small label drawn just inside a terminal (e.g. A, B, Cin, sel, 8/4/2/1). */
function pinLabel(c: ComponentInstance, def: ComponentDef, term: string, dir: "in" | "out"): string {
  const text = def.pinLabels?.[term];
  if (!text) return "";
  const p = terminalPos(c, def, term);
  const x = dir === "in" ? p.x + 9 : p.x - 9;
  return `<text class="pin-label" x="${x}" y="${p.y}" text-anchor="${dir === "in" ? "start" : "end"}">${esc(text)}</text>`;
}

/** Custom renderer: a 7-segment hex digit driven by 4 BCD inputs (in0 = LSB). */
function renderSevenSeg(
  c: ComponentInstance,
  def: ComponentDef,
  selected: boolean,
  inVals: Record<string, number>,
): string {
  const { w, h } = sizeOf(def);
  const digit =
    (inVals.in0 ? 1 : 0) | (inVals.in1 ? 2 : 0) | (inVals.in2 ? 4 : 0) | (inVals.in3 ? 8 : 0);
  const lit = SEG[digit] ?? "";
  const x0 = c.x + 28;
  const x1 = c.x + w - 12;
  const yT = c.y + 16;
  const yM = c.y + h / 2;
  const yB = c.y + h - 16;
  const seg = (k: string, a: number, b: number, d: number, e: number): string =>
    `<line class="seg${lit.includes(k) ? " is-on" : ""}" x1="${a}" y1="${b}" x2="${d}" y2="${e}" />`;
  const segs =
    seg("a", x0, yT, x1, yT) +
    seg("g", x0, yM, x1, yM) +
    seg("d", x0, yB, x1, yB) +
    seg("f", x0, yT, x0, yM) +
    seg("e", x0, yM, x0, yB) +
    seg("b", x1, yT, x1, yM) +
    seg("c", x1, yM, x1, yB);
  const terms = def.inputs.map((t) => termCircle(c, def, t, "in", inVals[t] === 1)).join("");
  const labels = def.inputs.map((t) => pinLabel(c, def, t, "in")).join("");
  return `<g class="comp${selected ? " is-selected" : ""}" data-id="${c.id}">
    <rect class="seg-body" x="${c.x}" y="${c.y}" width="${w}" height="${h}" rx="6" />
    ${segs}${terms}${labels}
  </g>`;
}

function renderComponent(
  c: ComponentInstance,
  def: ComponentDef,
  selected: boolean,
  outVals: Record<string, number>,
  inVals: Record<string, number>,
): string {
  if (def.render === "seven-seg") return renderSevenSeg(c, def, selected, inVals);

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

  // gate / block (world layer)
  const cx = c.x + w / 2;
  const terms =
    def.inputs.map((t) => termCircle(c, def, t, "in", inVals[t] === 1)).join("") +
    def.outputs.map((t) => termCircle(c, def, t, "out", outVals[t] === 1)).join("");
  const pins =
    def.inputs.map((t) => pinLabel(c, def, t, "in")).join("") +
    def.outputs.map((t) => pinLabel(c, def, t, "out")).join("");
  const labelY = def.sublabel ? c.y + h / 2 - 7 : c.y + h / 2;
  const sub = def.sublabel
    ? `<text class="gate-sublabel" x="${cx}" y="${c.y + h / 2 + 9}">${esc(def.sublabel)}</text>`
    : "";
  return `${head}
    <rect class="gate-body" x="${c.x}" y="${c.y}" width="${w}" height="${h}" />
    <text class="gate-label" x="${cx}" y="${labelY}">${esc(def.label)}</text>
    ${sub}${pins}${terms}
  </g>`;
}

function updateGrid(): void {
  if (!centerEl) return;
  const fine = 24 * view.zoom;
  const coarse = 120 * view.zoom;
  centerEl.style.backgroundPosition = `${view.panX}px ${view.panY}px`;
  centerEl.style.backgroundSize = `${coarse}px ${coarse}px, ${coarse}px ${coarse}px, ${fine}px ${fine}px, ${fine}px ${fine}px`;
}

function render(): void {
  const { circuit, sim, selection } = getState();
  const boardW = svg.clientWidth || 960;
  layoutRails(circuit, boardW);
  updateGrid();

  const wires = circuit.wires
    .map((w) => {
      const p0 = terminalScreen(w.from);
      const p3 = terminalScreen(w.to);
      if (!p0 || !p3) return "";
      const high = sim.wireValues.get(w.id) === 1;
      const cls = [
        "wire",
        high ? "is-high" : "",
        sim.errors.cycleWireIds.includes(w.id) ? "is-cycle" : "",
        selection.has(w.id) ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const d = wirePath(p0, p3);
      // A second overlaid stroke carries the traveling pulse on live wires.
      const pulse = high ? `<path class="wire-pulse" d="${d}" />` : "";
      return `<path class="${cls}" data-id="${w.id}" d="${d}" />${pulse}`;
    })
    .join("");

  const part = (c: ComponentInstance): string => {
    const def = REGISTRY[c.type];
    return def
      ? renderComponent(c, def, selection.has(c.id), sim.outputs.get(c.id) ?? {}, sim.inputsOf.get(c.id) ?? {})
      : "";
  };
  const gates = circuit.components.filter((c) => !isPinned(c)).map(part).join("");
  const pins = circuit.components.filter(isPinned).map(part).join("");

  svg.innerHTML =
    `<g class="layer-wires">${wires}</g>` +
    `<g class="layer-world" transform="translate(${view.panX} ${view.panY}) scale(${view.zoom})">${gates}</g>` +
    `<g class="layer-pins">${pins}</g>` +
    `<path id="wire-preview" class="wire wire--preview" d="" />`;

  if (emptyEl) emptyEl.style.display = circuit.components.length ? "none" : "";
}
