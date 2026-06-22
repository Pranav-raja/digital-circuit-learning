/*
 * ui/Blocks.ts — subcircuits / reusable blocks (spec §12, Phase 6).
 * "Group" collapses the current selection into one block whose pins are the
 * input/output parts inside it; the block lands in a "My Blocks" palette section
 * to drop again. Select parts with shift-click (or Ctrl/⌘+A), then Ctrl/⌘+G.
 */

import { getState, subscribe, update, checkpoint, select } from "../store";
import { groupSelection, addSubInstance } from "../core/model";
import { centerWorld } from "../canvas/Canvas";

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const chevron = `<svg class="cat__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2 l4 4 l-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function initBlocks(setMessage: (msg: string) => void): void {
  const host = document.getElementById("palette-blocks");
  if (!host) return;

  const render = (): void => {
    const defs = getState().circuit.subcircuits ?? [];
    const items = defs.length
      ? defs
          .map(
            (d) =>
              `<span class="chip-row"><button class="chip" data-sub="${d.id}" title="Place ${esc(d.name)}">${esc(d.name)}</button></span>`,
          )
          .join("")
      : `<span class="cat__hint">Select parts (shift-click), then Group to make a reusable block.</span>`;
    host.innerHTML = `<details class="cat" open><summary>${chevron}<span>My Blocks</span></summary>
      <div class="cat__items">${items}</div></details>`;
  };
  subscribe(render);
  render();

  // place a block instance at the viewport center
  host.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-sub]");
    if (!b) return;
    const ctr = centerWorld();
    checkpoint();
    update((c) => addSubInstance(c, b.dataset.sub!, ctr.x, ctr.y));
  });

  // group the current selection into a block
  const group = (): void => {
    const { circuit, selection } = getState();
    const ids = [...selection].filter((id) => circuit.components.some((c) => c.id === id));
    if (!ids.length) {
      setMessage("Select parts (shift-click), then Group.");
      return;
    }
    const name = window
      .prompt("Name this block:", `Block ${(circuit.subcircuits?.length ?? 0) + 1}`)
      ?.trim();
    if (!name) return;
    checkpoint();
    const res = update((c) => groupSelection(c, ids, name));
    if (res.ok) {
      select([res.instance.id]);
      setMessage(
        res.dropped
          ? `Grouped “${name}” (${res.dropped} external wire${res.dropped === 1 ? "" : "s"} removed).`
          : `Grouped into “${name}”.`,
      );
    } else {
      setMessage(res.reason);
    }
  };

  document.getElementById("tb-group")?.addEventListener("click", group);
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      group();
    }
  });
}
