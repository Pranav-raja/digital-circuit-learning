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
