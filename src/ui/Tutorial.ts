/*
 * ui/Tutorial.ts — a guided, interactive first-run tour (spec §12 Phase 6).
 * A small non-blocking card walks a newcomer through building an AND gate. Each
 * step watches the live circuit and auto-advances when its goal is met, so the
 * tutorial follows what the user actually does. The board stays fully usable.
 */

import { getState, subscribe, type AppState } from "../store";

interface Step {
  title: string;
  body: string;
  done?: (s: AppState) => boolean; // auto-advance when true; absent = manual Next
  highlight?: string; // CSS selector to pulse while this step is active
}

const DONE_KEY = "logiclab:tutorial-done";
const countType = (s: AppState, t: string): number =>
  s.circuit.components.filter((c) => c.type === t).length;

function andWired(s: AppState): boolean {
  const and = s.circuit.components.find((c) => c.type === "and");
  const out = s.circuit.components.find((c) => c.type === "output");
  if (!and || !out) return false;
  const w = s.circuit.wires;
  const fed = (comp: string, term: string): boolean =>
    w.some((x) => x.to.comp === comp && x.to.term === term);
  return (
    fed(and.id, "in0") &&
    fed(and.id, "in1") &&
    w.some((x) => x.from.comp === and.id) &&
    w.some((x) => x.to.comp === out.id)
  );
}

const anyOutputLit = (s: AppState): boolean =>
  s.circuit.components.some(
    (c) => c.type === "output" && (s.sim.inputsOf.get(c.id)?.in0 ?? 0) === 1,
  );

const STEPS: Step[] = [
  {
    title: "Welcome to Logic Lab",
    body: "Let's build your first circuit — an AND gate that lights a lamp only when two switches are both on. Click Next to begin.",
  },
  {
    title: "Add two inputs",
    body: "Inputs are switches that feed a 1 or 0 into your circuit. Click “+ Add input” on the left rail twice.",
    highlight: ".rail-band--in .rail-band__add",
    done: (s) => countType(s, "input") >= 2,
  },
  {
    title: "Add an AND gate",
    body: "In the Gates section of the palette, click AND to drop one on the board.",
    highlight: '.chip[data-type="and"]',
    done: (s) => countType(s, "and") >= 1,
  },
  {
    title: "Add an output lamp",
    body: "Outputs glow when they receive a 1. Click “+ Add output” on the right rail.",
    highlight: ".rail-band--out .rail-band__add",
    done: (s) => countType(s, "output") >= 1,
  },
  {
    title: "Wire it together",
    body: "Drag from each input's right dot to the AND's two left dots, then from the AND's right dot to the lamp's left dot.",
    done: andWired,
  },
  {
    title: "Flip the switches",
    body: "Click an input to toggle it between 0 and 1. Turn BOTH inputs on to light the lamp.",
    done: anyOutputLit,
  },
  {
    title: "🎉 You built an AND gate!",
    body: "The lamp lights only when both inputs are 1 — that's AND. Click any part's ⓘ icon, or the Guide button, to keep exploring.",
  },
];

export function initTutorial(): void {
  const host = document.createElement("div");
  host.innerHTML = `
    <aside class="tutorial" id="tutorial" role="dialog" aria-label="Tutorial" hidden>
      <div class="tutorial__head">
        <span class="tutorial__step" id="tut-step"></span>
        <button class="tutorial__skip" id="tut-skip">Skip tour</button>
      </div>
      <h3 class="tutorial__title" id="tut-title"></h3>
      <p class="tutorial__body" id="tut-body"></p>
      <div class="tutorial__nav">
        <button class="tutorial__back" id="tut-back">Back</button>
        <button class="tutorial__next" id="tut-next">Next</button>
      </div>
    </aside>`;
  document.body.appendChild(host);

  const card = host.querySelector<HTMLElement>("#tutorial")!;
  const stepEl = host.querySelector<HTMLElement>("#tut-step")!;
  const titleEl = host.querySelector<HTMLElement>("#tut-title")!;
  const bodyEl = host.querySelector<HTMLElement>("#tut-body")!;
  const backBtn = host.querySelector<HTMLButtonElement>("#tut-back")!;
  const nextBtn = host.querySelector<HTMLButtonElement>("#tut-next")!;

  let active = false;
  let i = 0;

  const clearHighlight = (): void =>
    document.querySelectorAll(".tut-highlight").forEach((el) => el.classList.remove("tut-highlight"));

  const goto = (n: number): void => {
    clearHighlight();
    if (n < 0 || n >= STEPS.length) return finish();
    i = n;
    const step = STEPS[i];
    stepEl.textContent = `Step ${i + 1} of ${STEPS.length}`;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    backBtn.hidden = i === 0;
    nextBtn.textContent = i === STEPS.length - 1 ? "Finish" : "Next";
    if (step.highlight) document.querySelector(step.highlight)?.classList.add("tut-highlight");
  };

  const finish = (): void => {
    active = false;
    card.hidden = true;
    clearHighlight();
    localStorage.setItem(DONE_KEY, "1");
  };

  const start = (): void => {
    active = true;
    card.hidden = false;
    goto(0);
  };

  backBtn.addEventListener("click", () => goto(i - 1));
  nextBtn.addEventListener("click", () => goto(i + 1));
  host.querySelector("#tut-skip")!.addEventListener("click", finish);
  document.getElementById("tb-tutorial")?.addEventListener("click", start);

  // Auto-advance when the active step's goal is reached.
  subscribe((s) => {
    if (active && STEPS[i].done?.(s)) goto(i + 1);
  });

  // First-time visitors with a blank board get the tour automatically.
  if (!localStorage.getItem(DONE_KEY) && getState().circuit.components.length === 0) start();
}
