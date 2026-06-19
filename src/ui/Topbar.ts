/*
 * ui/Topbar.ts — global file actions (spec §4, Phase 3): New, Save (named),
 * Open ▾ (the "My Circuits" list), Export, Import. The autosave heartbeat already
 * guards the working circuit; these are the user's portable, named artifacts.
 */

import { getState, update, checkpoint, loadCircuit } from "../store";
import { createCircuit } from "../core/model";
import { exportCircuit, pickAndImport } from "../storage/files";
import { listSaved, saveNamed, loadNamed, deleteNamed } from "../storage/local";

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function initTopbar(setMessage: (msg: string) => void): void {
  const byId = (id: string): HTMLElement => document.getElementById(id)!;
  const openBtn = byId("tb-open");
  const menu = byId("tb-open-menu");

  // ---- New ----
  byId("tb-new").addEventListener("click", () => {
    checkpoint();
    loadCircuit(createCircuit());
    setMessage("New circuit.");
  });

  // ---- Save (named) ----
  byId("tb-save").addEventListener("click", () => {
    const name = window.prompt("Save circuit as:", getState().circuit.name)?.trim();
    if (!name) return;
    update((c) => {
      c.name = name;
    });
    const meta = saveNamed(getState().circuit, name);
    setMessage(meta ? `Saved “${name}”.` : "Couldn't save — storage may be full.");
    renderMenu();
  });

  // ---- Export / Import ----
  byId("tb-export").addEventListener("click", () => exportCircuit(getState().circuit));
  byId("tb-import").addEventListener("click", async () => {
    const res = await pickAndImport();
    if (!res) return;
    if (res.ok) {
      checkpoint();
      loadCircuit(res.circuit);
      setMessage(`Imported “${res.circuit.name}”.`);
    } else {
      setMessage(res.error);
    }
  });

  // ---- Open ▾ menu ----
  function renderMenu(): void {
    const saved = listSaved().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    menu.innerHTML = saved.length
      ? saved
          .map(
            (m) => `<div class="menu__row">
              <button class="menu__load" data-id="${m.id}">
                <span class="menu__name">${esc(m.name)}</span>
                <span class="menu__time">${relTime(m.updatedAt)}</span>
              </button>
              <button class="menu__del" data-id="${m.id}" title="Delete" aria-label="Delete ${esc(m.name)}">&times;</button>
            </div>`,
          )
          .join("")
      : `<div class="menu__empty">No saved circuits yet. Use Save to add one.</div>`;
  }

  function setOpen(show: boolean): void {
    if (show) renderMenu();
    menu.hidden = !show;
    openBtn.setAttribute("aria-expanded", String(show));
  }

  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(menu.hidden === true);
  });

  menu.addEventListener("click", (e) => {
    const target = e.target as Element;
    const del = target.closest<HTMLElement>(".menu__del");
    if (del) {
      e.stopPropagation();
      deleteNamed(del.dataset.id!);
      renderMenu();
      setMessage("Deleted.");
      return;
    }
    const load = target.closest<HTMLElement>(".menu__load");
    if (load) {
      const circuit = loadNamed(load.dataset.id!);
      if (circuit) {
        checkpoint();
        loadCircuit(circuit);
        setMessage(`Opened “${circuit.name}”.`);
      } else {
        setMessage("Couldn't open that circuit.");
      }
      setOpen(false);
    }
  });

  // click outside / Esc closes the menu
  document.addEventListener("click", () => {
    if (!menu.hidden) setOpen(false);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) setOpen(false);
  });
}
