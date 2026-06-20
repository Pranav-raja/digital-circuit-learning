/*
 * store.ts — app state + the one change path (architecture §5).
 * Mutate the circuit through `update()`; the store recomputes the simulation and
 * notifies listeners. Undo/redo is a snapshot history (Phase 2): callers take a
 * `checkpoint()` immediately before an undoable action.
 */

import type { Bit, Circuit } from "./core/types";
import { createCircuit, seedIds } from "./core/model";
import { evaluate, type SimResult, type StateMap } from "./core/engine";
import { REGISTRY } from "./core/registry";

export interface AppState {
  circuit: Circuit;
  selection: Set<string>; // selected component / wire ids
  sim: SimResult;
}

type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

// Sequential (flip-flop) state lives here and is threaded through evaluate so the
// engine stays pure. It persists across user edits and resets on undo/redo/load.
let seqState: StateMap = new Map();

const circuit = createCircuit();
const initialSim = evaluate(circuit, REGISTRY, seqState);
seqState = initialSim.state;
const state: AppState = {
  circuit,
  selection: new Set(),
  sim: initialSim,
};

// ---- undo / redo history ---------------------------------------------------
const HISTORY_LIMIT = 100;
let past: Circuit[] = [];
let future: Circuit[] = [];
const clone = (c: Circuit): Circuit => structuredClone(c);

export const getState = (): AppState => state;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  for (const fn of listeners) fn(state);
}

function resimulate(): void {
  state.sim = evaluate(state.circuit, REGISTRY, seqState);
  seqState = state.sim.state;
}

/**
 * Advance all clocks one half-period. Silent: no updatedAt bump (autosave skips)
 * and no history entry — clock phase is transient simulation, not a user edit.
 */
export function tickClock(): void {
  const clocks = state.circuit.components.filter((c) => c.type === "clock");
  if (!clocks.length) return;
  for (const c of clocks) c.value = (c.value ? 0 : 1) as Bit;
  resimulate();
  emit();
}

/** Mutate the circuit, re-simulate, and notify. Returns the mutator's result. */
export function update<T>(mutator: (circuit: Circuit) => T): T {
  const result = mutator(state.circuit);
  state.circuit.updatedAt = new Date().toISOString();
  resimulate();
  emit();
  return result;
}

/** Change the selection only (no re-simulation, no history). */
export function select(ids: string[]): void {
  state.selection = new Set(ids);
  emit();
}

/** Snapshot the current circuit for undo. Call right before an undoable change. */
export function checkpoint(): void {
  past.push(clone(state.circuit));
  if (past.length > HISTORY_LIMIT) past.shift();
  future = [];
}

export const canUndo = (): boolean => past.length > 0;
export const canRedo = (): boolean => future.length > 0;

function swapTo(next: Circuit, stash: Circuit[]): void {
  stash.push(clone(state.circuit));
  next.updatedAt = new Date().toISOString(); // mark so autosave persists the result
  state.circuit = next;
  state.selection = new Set();
  seqState = new Map(); // flip-flop state from another timeline is stale
  resimulate();
  emit();
}

export function undo(): void {
  const prev = past.pop();
  if (prev) swapTo(prev, future);
}

export function redo(): void {
  const next = future.pop();
  if (next) swapTo(next, past);
}

/** Replace the whole circuit (e.g. restore from storage). Clears history. */
export function loadCircuit(next: Circuit): void {
  seedIds(next); // continue id generation past loaded ids
  state.circuit = next;
  state.selection = new Set();
  past = [];
  future = [];
  seqState = new Map();
  resimulate();
  emit();
}
