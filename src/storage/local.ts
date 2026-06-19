/*
 * storage/local.ts — autosave + restore via localStorage (spec §10, Phase 2).
 * The circuit IS the save file (ADR-006), so persistence is JSON.stringify/parse
 * plus validation. Named "My Circuits" saves arrive in Phase 3.
 */

import type { Circuit } from "../core/types";
import { validateCircuit } from "../core/model";

const CURRENT_KEY = "logiclab:current";

/** Write the working circuit. Returns false on failure (e.g. quota exceeded). */
export function saveCurrent(circuit: Circuit): boolean {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(circuit));
    return true;
  } catch {
    return false;
  }
}

/** Restore the working circuit, or null if absent / corrupt / wrong version. */
export function loadCurrent(): Circuit | null {
  const raw = localStorage.getItem(CURRENT_KEY);
  if (!raw) return null;
  try {
    const res = validateCircuit(JSON.parse(raw));
    return res.ok ? res.circuit : null;
  } catch {
    return null;
  }
}

export interface AutosaveOptions {
  delay?: number; // debounce window, ms (spec §10: ~800)
  onSaved?: (ts: number) => void; // heartbeat hook
  onError?: (msg: string) => void; // plain-language failure (spec §13)
}

export interface Autosaver {
  schedule: (circuit: Circuit) => void; // debounced save
  flush: (circuit: Circuit) => void; // save now (e.g. Ctrl/Cmd+S)
}

/**
 * A debounced autosaver. Skips redundant writes by comparing `updatedAt`, so a
 * selection-only change doesn't rewrite the file.
 */
export function createAutosaver(opts: AutosaveOptions = {}): Autosaver {
  const delay = opts.delay ?? 800;
  let timer: number | undefined;
  let lastStamp = "";

  const write = (circuit: Circuit): void => {
    if (saveCurrent(circuit)) {
      lastStamp = circuit.updatedAt;
      opts.onSaved?.(Date.now());
    } else {
      opts.onError?.("Couldn't autosave — browser storage may be full.");
    }
  };

  return {
    schedule(circuit) {
      if (circuit.updatedAt === lastStamp) return; // nothing changed since last save
      if (timer !== undefined) clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        write(circuit);
      }, delay);
    },
    flush(circuit) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      write(circuit);
    },
  };
}

// ---- named "My Circuits" saves (spec §10) ---------------------------------
// An index of metadata lives at logiclab:saved:index; each circuit at
// logiclab:saved:<id>. Saving with an existing name overwrites that entry.

const INDEX_KEY = "logiclab:saved:index";
const itemKey = (id: string): string => `logiclab:saved:${id}`;

export interface SavedMeta {
  id: string;
  name: string;
  updatedAt: string;
}

const newSavedId = (): string => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function listSaved(): SavedMeta[] {
  try {
    const list = JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Save (or overwrite, when the name matches) a named circuit. null on failure. */
export function saveNamed(circuit: Circuit, name: string): SavedMeta | null {
  const list = listSaved();
  const existing = list.find((m) => m.name === name);
  const id = existing?.id ?? newSavedId();
  const updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(itemKey(id), JSON.stringify({ ...circuit, name, updatedAt }));
    const meta: SavedMeta = { id, name, updatedAt };
    localStorage.setItem(
      INDEX_KEY,
      JSON.stringify(existing ? list.map((m) => (m.id === id ? meta : m)) : [...list, meta]),
    );
    return meta;
  } catch {
    return null;
  }
}

export function loadNamed(id: string): Circuit | null {
  const raw = localStorage.getItem(itemKey(id));
  if (!raw) return null;
  try {
    const res = validateCircuit(JSON.parse(raw));
    return res.ok ? res.circuit : null;
  } catch {
    return null;
  }
}

export function deleteNamed(id: string): void {
  localStorage.removeItem(itemKey(id));
  localStorage.setItem(INDEX_KEY, JSON.stringify(listSaved().filter((m) => m.id !== id)));
}
