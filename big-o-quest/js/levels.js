import {
  accessByIndex,
  linearSearch,
  binarySearch,
  mergeSort,
  selectionSort,
} from "./algorithms.js";

/**
 * Small seeded random generator (mulberry32), so comparisons are repeatable.
 * @param {number} seed
 * @returns {() => number} returns numbers in [0, 1)
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMPARISON_SEED = 99;

function range(n) {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function shuffle(values, rng) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomIndex(n, rng) {
  return Math.floor(rng() * n);
}

/** Picks n distinct sorted numbers from 1..4n. */
function sortedChests(n, rng) {
  return shuffle(range(4 * n), rng).slice(0, n).sort((a, b) => a - b);
}

/**
 * Rows for the comparison screen. The worst case is used on purpose:
 * the key is in the last room, and both search methods get the same chests.
 * @param {string} levelId
 * @param {number} n
 */
export function comparisonFor(levelId, n) {
  const sorted = range(n);
  const shuffled = shuffle(range(n), mulberry32(COMPARISON_SEED));
  const worstTarget = n;

  switch (levelId) {
    case "o1": {
      const run = accessByIndex(sorted, n - 1);
      return [{ name: "Direct array access", complexity: "O(1)", operations: run.counts.access, detail: "one read" }];
    }
    case "logn":
    case "on":
      return searchRows(sorted, worstTarget);
    case "onlogn":
    case "on2":
      return sortRows(shuffled);
    default:
      return [];
  }
}

function searchRows(sorted, target) {
  const linear = linearSearch(sorted, target);
  const binary = binarySearch(sorted, target);
  return [
    {
      name: "Linear search (key in last room)",
      complexity: "O(n)",
      operations: linear.counts.check,
      detail: "rooms checked",
    },
    {
      name: "Binary search (same sorted chests)",
      complexity: "O(log n)",
      operations: binary.counts.check,
      detail: "chests checked",
    },
  ];
}

function sortRows(values) {
  const selection = selectionSort(values).counts;
  const merge = mergeSort(values).counts;
  return [
    {
      name: "Selection sort (same shuffled coins)",
      complexity: "O(n²)",
      operations: selection.compare + selection.swap,
      comparisons: selection.compare,
      swaps: selection.swap,
    },
    {
      name: "Merge sort (same shuffled crystals)",
      complexity: "O(n log n)",
      operations: merge.compare + merge.write,
      comparisons: merge.compare,
      writes: merge.write,
    },
  ];
}

/**
 * Each level generates its own input, runs its algorithm, and describes the task.
 * @param {number} n
 * @param {() => number} rng
 */
function runMagicInventory(n, rng) {
  const values = shuffle(range(n), rng);
  const slot = randomIndex(n, rng);
  return { values, prompt: `Find items[${slot}]`, ...accessByIndex(values, slot) };
}

function runTreasureSearch(n, rng) {
  const values = sortedChests(n, rng);
  const target = values[randomIndex(n, rng)];
  return { values, prompt: `Find treasure number ${target}`, ...binarySearch(values, target) };
}

function runDungeonSearch(n, rng) {
  const values = shuffle(range(n), rng);
  const target = values[randomIndex(n, rng)];
  return { values, prompt: `Find the key number ${target}`, ...linearSearch(values, target) };
}

function runCrystalMerge(n, rng) {
  const values = shuffle(range(n), rng);
  return { values, prompt: "Put the crystals in order", ...mergeSort(values) };
}

function runCoinSelection(n, rng) {
  const values = shuffle(range(n), rng);
  return { values, prompt: "Put the coins in order", ...selectionSort(values) };
}

export const LEVELS = [
  {
    id: "o1",
    title: "Magic Inventory",
    complexity: "O(1)",
    kind: "access",
    operationLabel: "Array reads (items[index])",
    hideValues: false,
    instructions:
      "The array is items. Each box has a small index under it, and the number inside is its value. You are asked to read one index, such as items[8]. Click the box at that index. Only a correct read counts as an operation.",
    explanation:
      "The index tells the computer exactly where the value is, so it reads that one place: items[8] costs one array read. With 9 boxes or 9,000, it is still one read, so the work is O(1).",
    note: "Clicking a wrong box is a mistake, not an array read. Finding an item by its value would be a different job, because you would have to search. Here the index is already known.",
    run: runMagicInventory,
  },
  {
    id: "logn",
    title: "Treasure Search",
    complexity: "O(log n)",
    kind: "search",
    operationLabel: "Chests checked",
    hideValues: false,
    instructions:
      "The chests are sorted by their numbers. Each check opens the middle chest of what is left. If its number is too high or too low, throw away that half.",
    explanation:
      "Each check throws away half of the chests that are left. So the number of checks grows with log n, and doubling n adds about one check.",
    note: "The chests must already be sorted. Sorting them first has its own cost (about n log n with merge sort), which this count does not include.",
    run: runTreasureSearch,
  },
  {
    id: "on",
    title: "Dungeon Search",
    complexity: "O(n)",
    kind: "search",
    operationLabel: "Rooms checked",
    hideValues: true,
    instructions:
      "The key is in one of the rooms. Rooms are hidden until you check them. Check rooms in order until you find the key.",
    explanation:
      "In the worst case the key is in the last room, so every room is checked. Doubling n doubles the number of checks.",
    note: "One lucky search does not show the worst case. The comparison always puts the key in the last room.",
    run: runDungeonSearch,
  },
  {
    id: "onlogn",
    title: "Crystal Merge",
    complexity: "O(n log n)",
    kind: "sort",
    operationLabel: "Comparisons and writes",
    hideValues: false,
    instructions:
      "Split the crystals into halves, sort each half, then merge the halves. Comparisons (which crystal is smaller) and writes (a crystal placed into the list) are counted separately.",
    explanation:
      "Merge sort halves the list about log n times, and each level of halving costs about n work. The total is n log n, so doubling n adds a bit more than double.",
    note: "Merge sort needs temporary arrays for the halves while it merges.",
    run: runCrystalMerge,
  },
  {
    id: "on2",
    title: "Coin Selection",
    complexity: "O(n²)",
    kind: "sort",
    operationLabel: "Comparisons and swaps",
    hideValues: false,
    instructions:
      "For each position, scan the coins that are left and find the smallest. Swap it into place. Comparisons and swaps are counted separately.",
    explanation:
      "Each pass scans all the coins that are left, which is about n(n-1)/2 comparisons. Doubling n roughly quadruples the work.",
    note: "Few swaps does not mean little work. The comparisons are what grow quickly.",
    run: runCoinSelection,
  },
];

/** @param {string} id */
export function getLevel(id) {
  return LEVELS.find((level) => level.id === id);
}
