/*
 * store.ts — app state + the one change path (architecture §5).
 * Mutate the circuit through `update()`; the store recomputes the simulation and
 * notifies listeners. The canvas, UI, and (later) persistence all just subscribe.
 */

import type { Circuit } from "./core/types";
import { createCircuit } from "./core/model";
import { evaluate, type SimResult } from "./core/engine";
import { REGISTRY } from "./core/registry";

export interface AppState {
  circuit: Circuit;
  selection: Set<string>; // selected component / wire ids
  sim: SimResult;
}

type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

const circuit = createCircuit();
const state: AppState = {
  circuit,
  selection: new Set(),
  sim: evaluate(circuit, REGISTRY),
};

export const getState = (): AppState => state;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  for (const fn of listeners) fn(state);
}

/** Mutate the circuit, re-simulate, and notify. Returns the mutator's result. */
export function update<T>(mutator: (circuit: Circuit) => T): T {
  const result = mutator(state.circuit);
  state.circuit.updatedAt = new Date().toISOString();
  state.sim = evaluate(state.circuit, REGISTRY);
  emit();
  return result;
}

/** Change the selection only (no re-simulation needed). */
export function select(ids: string[]): void {
  state.selection = new Set(ids);
  emit();
}
