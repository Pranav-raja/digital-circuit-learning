/*
 * ui/StatusBar.ts — quiet telemetry (spec §4): live component/wire counts, plus
 * a transient channel for plain-language messages (spec §13). The autosave
 * heartbeat lands here in Phase 2.
 */

import { getState, subscribe } from "../store";

export interface StatusBar {
  setMessage: (msg: string) => void;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export function initStatusBar(): StatusBar {
  const countEl = document.getElementById("sb-count")!;
  const metaEl = document.getElementById("sb-meta")!;
  let messageTimer: number | undefined;

  const renderCounts = (): void => {
    const { circuit } = getState();
    countEl.textContent = `${plural(circuit.components.length, "component")} · ${plural(
      circuit.wires.length,
      "wire",
    )}`;
  };

  // While a message is showing, leave it be; counts refresh when it clears.
  subscribe(() => {
    if (messageTimer === undefined) renderCounts();
  });
  renderCounts();
  metaEl.textContent = "zoom 100% · not saved yet"; // autosave heartbeat: Phase 2

  return {
    setMessage(msg: string) {
      countEl.textContent = msg;
      if (messageTimer !== undefined) clearTimeout(messageTimer);
      messageTimer = window.setTimeout(() => {
        messageTimer = undefined;
        renderCounts();
      }, 2500);
    },
  };
}
