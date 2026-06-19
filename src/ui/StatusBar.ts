/*
 * ui/StatusBar.ts — quiet telemetry (spec §4): live component/wire counts, the
 * autosave heartbeat ("saved 12s ago" — spec §10/§4), and a transient channel
 * for plain-language messages (spec §13).
 */

import { getState, subscribe } from "../store";

export interface StatusBar {
  setMessage: (msg: string) => void;
  setSaved: (ts: number) => void;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 3) return "saved just now";
  if (s < 60) return `saved ${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `saved ${m}m ago`;
  return `saved ${Math.floor(m / 60)}h ago`;
}

export function initStatusBar(): StatusBar {
  const countEl = document.getElementById("sb-count")!;
  const metaEl = document.getElementById("sb-meta")!;
  let messageTimer: number | undefined;
  let savedAt: number | null = null;

  const renderCounts = (): void => {
    const { circuit } = getState();
    countEl.textContent = `${plural(circuit.components.length, "component")} · ${plural(
      circuit.wires.length,
      "wire",
    )}`;
  };

  const renderMeta = (): void => {
    metaEl.textContent = `zoom 100% · ${savedAt === null ? "not saved yet" : ago(savedAt)}`;
  };

  // While a message is showing, leave the count be; it refreshes when the message clears.
  subscribe(() => {
    if (messageTimer === undefined) renderCounts();
  });
  renderCounts();
  renderMeta();
  setInterval(renderMeta, 1000); // keep the relative "Xs ago" honest

  return {
    setMessage(msg: string) {
      countEl.textContent = msg;
      if (messageTimer !== undefined) clearTimeout(messageTimer);
      messageTimer = window.setTimeout(() => {
        messageTimer = undefined;
        renderCounts();
      }, 2500);
    },
    setSaved(ts: number) {
      savedAt = ts;
      renderMeta();
    },
  };
}
