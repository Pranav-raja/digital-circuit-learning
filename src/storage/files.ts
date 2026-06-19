/*
 * storage/files.ts — export / import the circuit as a portable .json (spec §10).
 * The circuit IS the file (ADR-006), so this is stringify/parse + validation with
 * a download/upload shell around it. No translation layer.
 */

import type { Circuit } from "../core/types";
import { validateCircuit } from "../core/model";

/** Filesystem-friendly slug for the download name, derived from the circuit name. */
const safeName = (name: string): string =>
  (name.trim() || "circuit").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
  "circuit";

/** Serialize and trigger a download of `<name>.json`. */
export function exportCircuit(circuit: Circuit): void {
  const blob = new Blob([JSON.stringify(circuit, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(circuit.name)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ImportResult = { ok: true; circuit: Circuit } | { ok: false; error: string };

/** Read + validate a chosen file. Never throws — returns a typed result. */
export async function importCircuitFile(file: File): Promise<ImportResult> {
  try {
    const res = validateCircuit(JSON.parse(await file.text()));
    return res.ok ? { ok: true, circuit: res.circuit } : { ok: false, error: res.error };
  } catch {
    return { ok: false, error: "That file looks corrupted." };
  }
}

/** Open a native file picker and import the chosen .json (null if cancelled). */
export function pickAndImport(): Promise<ImportResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) resolve(null);
      else void importCircuitFile(file).then(resolve);
    });
    input.click();
  });
}
