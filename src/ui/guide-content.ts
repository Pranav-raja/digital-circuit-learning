/*
 * ui/guide-content.ts — the in-app manual (teaching content), keyed by component
 * type. Deliberately separate from core/registry.ts: the registry is logic and
 * shape; this is prose. Adding a part's help is a data entry here.
 */

export interface TruthTable {
  cols: string[];
  rows: (string | number)[][];
}

export interface GuideEntry {
  title: string;
  summary: string;
  how: string[];
  truth?: TruthTable;
  use: string[];
  where: string[];
}

/** Nav grouping + ordering for the guide drawer. */
export const GUIDE_ORDER: { category: string; types: string[] }[] = [
  { category: "Gates", types: ["and", "or", "not", "nand", "nor", "xor", "xnor"] },
  { category: "I/O", types: ["input", "output"] },
  { category: "Selectors", types: ["mux2", "mux4"] },
  { category: "Arithmetic", types: ["halfadder", "fulladder"] },
  { category: "Display", types: ["sevenseg"] },
];

export const GUIDE: Record<string, GuideEntry> = {
  and: {
    title: "AND gate",
    summary: "Outputs 1 only when both inputs are 1 — the logical 'both must be true'.",
    how: [
      "Two inputs, one output.",
      "The output is HIGH (1) only if input A AND input B are both 1. Any 0 makes the output 0.",
    ],
    truth: {
      cols: ["A", "B", "Out"],
      rows: [
        [0, 0, 0],
        [0, 1, 0],
        [1, 0, 0],
        [1, 1, 1],
      ],
    },
    use: [
      "Drag from each input's right terminal to the AND's two left terminals.",
      "Wire the right terminal to an output LED to watch the result.",
    ],
    where: [
      "Gating a signal so it only passes when two conditions hold (e.g. 'armed AND triggered').",
      "The carry bit of a half-adder is just A AND B.",
    ],
  },
  or: {
    title: "OR gate",
    summary: "Outputs 1 when at least one input is 1.",
    how: ["Two inputs, one output.", "The output is HIGH if A OR B (or both) is 1. Only 0+0 gives 0."],
    truth: {
      cols: ["A", "B", "Out"],
      rows: [
        [0, 0, 0],
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 1],
      ],
    },
    use: ["Wire two signals into the left terminals; read the right terminal."],
    where: [
      "Combining alarms: ring if the door OR the window opens.",
      "Setting a flag when any one of several sources fires.",
    ],
  },
  not: {
    title: "NOT gate (inverter)",
    summary: "Flips the input: 1 becomes 0, and 0 becomes 1.",
    how: ["One input, one output.", "The output is always the opposite of the input."],
    truth: {
      cols: ["A", "Out"],
      rows: [
        [0, 1],
        [1, 0],
      ],
    },
    use: ["Wire one signal into the single left terminal; the right terminal is its inverse."],
    where: [
      "Building NAND and NOR from AND/OR.",
      "Active-low signals, and toggling a stored state.",
    ],
  },
  nand: {
    title: "NAND gate",
    summary: "NOT-AND: outputs 0 only when both inputs are 1; otherwise 1.",
    how: ["It is an AND gate followed by a NOT — the exact opposite of AND."],
    truth: {
      cols: ["A", "B", "Out"],
      rows: [
        [0, 0, 1],
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ],
    },
    use: ["Same wiring as AND; the output is inverted."],
    where: [
      "The 'universal gate' — every other gate (and whole circuits) can be built from NANDs alone.",
      "Extremely common in real CMOS chips because it is cheap to make.",
    ],
  },
  nor: {
    title: "NOR gate",
    summary: "NOT-OR: outputs 1 only when both inputs are 0.",
    how: ["An OR gate followed by a NOT — the exact opposite of OR."],
    truth: {
      cols: ["A", "B", "Out"],
      rows: [
        [0, 0, 1],
        [0, 1, 0],
        [1, 0, 0],
        [1, 1, 0],
      ],
    },
    use: ["Same wiring as OR; the output is inverted."],
    where: [
      "Also universal — any circuit can be built from NORs alone.",
      "Two cross-coupled NORs form an SR latch, the basis of memory (a stretch topic).",
    ],
  },
  xor: {
    title: "XOR gate (exclusive-OR)",
    summary: "Outputs 1 when the two inputs are different.",
    how: ["HIGH when exactly one input is 1. Equal inputs give 0."],
    truth: {
      cols: ["A", "B", "Out"],
      rows: [
        [0, 0, 0],
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ],
    },
    use: ["Wire two signals in; the output reports whether they differ."],
    where: [
      "The SUM bit of a binary adder is an XOR.",
      "Parity checks, and flipping bits (the core of simple encryption).",
    ],
  },
  xnor: {
    title: "XNOR gate (exclusive-NOR)",
    summary: "Outputs 1 when the two inputs are the same.",
    how: ["The opposite of XOR — HIGH when both inputs match."],
    truth: {
      cols: ["A", "B", "Out"],
      rows: [
        [0, 0, 1],
        [0, 1, 0],
        [1, 0, 0],
        [1, 1, 1],
      ],
    },
    use: ["Wire two signals in; the output is 1 only if they are equal."],
    where: ["Equality testing — 'are these two bits the same?'", "Building comparators."],
  },
  input: {
    title: "Input toggle",
    summary: "A switch that feeds a 1 or 0 into your circuit.",
    how: [
      "Lives on the left rail. Click it to flip between 0 (dim slate) and 1 (amber).",
      "Its single output can fan out to as many inputs as you like.",
    ],
    use: [
      "Add one with '+ Add input' or the Input part in the palette.",
      "Click to toggle; drag its right terminal to any input terminal to feed a signal.",
    ],
    where: [
      "The source of every signal — think of it as a button, switch, or sensor.",
      "Set the operands you want to test, then watch the outputs react.",
    ],
  },
  output: {
    title: "Output LED",
    summary: "A lamp that glows amber when the signal reaching it is 1.",
    how: [
      "Lives on the right rail. Its single left terminal accepts one wire.",
      "It lights up when the incoming signal is HIGH, and is dark when LOW.",
    ],
    use: [
      "Add one with '+ Add output' or the Output part in the palette.",
      "Wire any output terminal into it to read a result.",
    ],
    where: [
      "The result you are measuring — a lamp, indicator, or display.",
      "Watch the SUM and CARRY of an adder light up as you change the inputs.",
    ],
  },
  mux2: {
    title: "2-to-1 multiplexer",
    summary: "Passes one of two inputs through to the output, chosen by a select line.",
    how: [
      "Two data inputs (0 and 1) plus a select pin 'sel'.",
      "When sel is 0 the output equals input 0; when sel is 1 it equals input 1. A mux is a data switch.",
    ],
    truth: {
      cols: ["sel", "Out"],
      rows: [
        [0, "= in0"],
        [1, "= in1"],
      ],
    },
    use: [
      "Wire two data signals into pins 0 and 1, and a third signal into 'sel'.",
      "Toggle 'sel' to switch which input reaches the output.",
    ],
    where: [
      "Choosing between two data sources on a shared wire.",
      "Routing signals inside CPUs; larger muxes are built from these.",
    ],
  },
  mux4: {
    title: "4-to-1 multiplexer",
    summary: "Passes one of four inputs to the output, chosen by two select bits.",
    how: [
      "Four data inputs (0–3) and two select pins s1, s0 (s1 is the high bit).",
      "The 2-bit number s1 s0 picks the input: 00 to in0, 01 to in1, 10 to in2, 11 to in3.",
    ],
    truth: {
      cols: ["s1", "s0", "Out"],
      rows: [
        [0, 0, "= in0"],
        [0, 1, "= in1"],
        [1, 0, "= in2"],
        [1, 1, "= in3"],
      ],
    },
    use: ["Wire four data signals and two select signals; the select number chooses the output."],
    where: [
      "Selecting one of several registers or data lines.",
      "Building the data paths and ALUs inside a processor.",
    ],
  },
  halfadder: {
    title: "Half adder",
    summary: "Adds two single bits, producing a sum and a carry.",
    how: [
      "Inputs A and B; outputs S (sum) and C (carry).",
      "S is A XOR B, and C is A AND B. Since 1 + 1 = '10' in binary, that case gives S=0 and C=1.",
    ],
    truth: {
      cols: ["A", "B", "C", "S"],
      rows: [
        [0, 0, 0, 0],
        [0, 1, 0, 1],
        [1, 0, 0, 1],
        [1, 1, 1, 0],
      ],
    },
    use: ["Wire two inputs to A and B; read S and C on the right (labels are on the pins)."],
    where: [
      "The fundamental building block of binary addition.",
      "Handles the least-significant column of a bigger adder (it has no carry-in).",
    ],
  },
  fulladder: {
    title: "Full adder",
    summary: "Adds three bits — A, B, and a carry-in — giving a sum and carry-out.",
    how: [
      "Inputs A, B, and Cin; outputs S (sum) and Co (carry-out).",
      "It adds the three bits (a total of 0–3): S is the low bit of the total, Co is the high bit.",
    ],
    truth: {
      cols: ["A", "B", "Cin", "Co", "S"],
      rows: [
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 1],
        [0, 1, 0, 0, 1],
        [0, 1, 1, 1, 0],
        [1, 0, 0, 0, 1],
        [1, 0, 1, 1, 0],
        [1, 1, 0, 1, 0],
        [1, 1, 1, 1, 1],
      ],
    },
    use: ["Wire A, B, and a carry-in to Cin; chain Co into the next adder's Cin to add wider numbers."],
    where: [
      "Chained together to add multi-bit numbers (a ripple-carry adder).",
      "The arithmetic heart of every CPU.",
    ],
  },
  sevenseg: {
    title: "7-segment display",
    summary: "Shows a hex digit 0–F driven by four input bits.",
    how: [
      "Four inputs weighted 1, 2, 4, and 8 (binary; the '1' pin is least-significant).",
      "The 4-bit value (0–15) lights the seven bars to draw that digit: 0–9, then A, b, C, d, E, F.",
    ],
    use: [
      "Add four inputs and wire them to the 1 / 2 / 4 / 8 pins.",
      "Toggle the inputs to count up in binary and watch the digit change.",
    ],
    where: [
      "Calculator, clock, and meter displays.",
      "Showing a counter or register value to a human in a readable form.",
    ],
  },
};
