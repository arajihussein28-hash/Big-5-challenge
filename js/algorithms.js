/**
 * The five algorithms. Each one runs on its input and returns:
 *   - actions: a list of plain objects describing what happened, in order
 *   - counts:  how many operations of each kind were performed
 * Nothing here draws anything. The renderer replays the actions later.
 *
 * An action may carry a `decision` field: the correct answer to a choice
 * the player can make in Challenge mode.
 */

/** @returns {{access: number, check: number, compare: number, write: number, swap: number}} */
function emptyCounts() {
  return { access: 0, check: 0, compare: 0, write: 0, swap: 0 };
}

/**
 * O(1): read one slot directly by its number.
 * @param {unknown[]} items
 * @param {number} index
 */
export function accessByIndex(items, index) {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new RangeError(`Slot ${index} is outside 0..${items.length - 1}`);
  }
  const counts = emptyCounts();
  counts.access = 1;
  return {
    actions: [
      { type: "access", index, decision: { kind: "index", answer: index } },
      { type: "found", index },
    ],
    result: items[index],
    counts,
  };
}

/**
 * O(n): check rooms one at a time, in order, until the target is found.
 * @param {unknown[]} items
 * @param {unknown} target
 */
export function linearSearch(items, target) {
  const actions = [];
  const counts = emptyCounts();

  for (let i = 0; i < items.length; i += 1) {
    counts.check += 1;
    actions.push({ type: "check", index: i, decision: { kind: "index", answer: i } });
    if (items[i] === target) {
      actions.push({ type: "found", index: i });
      return { actions, found: i, counts };
    }
  }

  actions.push({ type: "notFound" });
  return { actions, found: -1, counts };
}

/**
 * O(log n): repeatedly check the middle of the remaining range.
 * The input must already be sorted in ascending order.
 * @param {number[]} sorted
 * @param {number} target
 */
export function binarySearch(sorted, target) {
  const actions = [];
  const counts = emptyCounts();
  let low = 0;
  let high = sorted.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    counts.check += 1;
    actions.push({ type: "check", index: mid, low, high, decision: { kind: "index", answer: mid } });

    const value = sorted[mid];
    if (value === target) {
      actions.push({ type: "found", index: mid });
      return { actions, found: mid, counts };
    }
    if (value < target) {
      actions.push({ type: "eliminate", from: low, to: mid });
      low = mid + 1;
    } else {
      actions.push({ type: "eliminate", from: mid, to: high });
      high = mid - 1;
    }
  }

  actions.push({ type: "notFound" });
  return { actions, found: -1, counts };
}

/**
 * O(n log n): split in halves, sort each half, then merge them back together.
 * Works on a private copy, so the input array is never changed.
 * @param {number[]} values
 */
export function mergeSort(values) {
  const sorted = [...values];
  const actions = [];
  const counts = emptyCounts();

  function writeAt(index, value) {
    sorted[index] = value;
    counts.write += 1;
    actions.push({ type: "write", index, value });
  }

  function merge(from, mid, to) {
    const left = sorted.slice(from, mid);
    const right = sorted.slice(mid, to);
    actions.push({ type: "merge-start", from, mid, to, left, right });

    let li = 0;
    let ri = 0;
    let k = from;
    while (li < left.length && ri < right.length) {
      const pickLeft = left[li] <= right[ri];
      counts.compare += 1;
      actions.push({
        type: "merge-compare",
        left: left[li],
        right: right[ri],
        li,
        ri,
        decision: { kind: "side", answer: pickLeft ? "left" : "right" },
      });
      writeAt(k, pickLeft ? left[li] : right[ri]);
      if (pickLeft) li += 1;
      else ri += 1;
      k += 1;
    }
    while (li < left.length) {
      writeAt(k, left[li]);
      li += 1;
      k += 1;
    }
    while (ri < right.length) {
      writeAt(k, right[ri]);
      ri += 1;
      k += 1;
    }
    actions.push({ type: "merge-end", from, to });
  }

  function sortRange(from, to) {
    if (to - from <= 1) return;
    const mid = Math.floor((from + to) / 2);
    actions.push({ type: "split", from, to, mid });
    sortRange(from, mid);
    sortRange(mid, to);
    merge(from, mid, to);
  }

  sortRange(0, sorted.length);
  actions.push({ type: "done" });
  return { actions, sorted, counts };
}

/**
 * Index of the smallest value at or after `start`.
 * @param {number[]} values
 * @param {number} start
 */
function indexOfMinFrom(values, start) {
  let minIndex = start;
  for (let j = start + 1; j < values.length; j += 1) {
    if (values[j] < values[minIndex]) minIndex = j;
  }
  return minIndex;
}

/**
 * O(n²): each pass finds the smallest remaining value and moves it forward.
 * Works on a private copy, so the input array is never changed.
 * @param {number[]} values
 */
export function selectionSort(values) {
  const sorted = [...values];
  const actions = [];
  const counts = emptyCounts();

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const answer = indexOfMinFrom(sorted, i);
    actions.push({ type: "pass", index: i, decision: { kind: "index", answer } });

    let minIndex = i;
    for (let j = i + 1; j < sorted.length; j += 1) {
      counts.compare += 1;
      actions.push({ type: "compare", index: j, min: minIndex });
      if (sorted[j] < sorted[minIndex]) minIndex = j;
    }

    if (minIndex !== i) {
      [sorted[i], sorted[minIndex]] = [sorted[minIndex], sorted[i]];
      counts.swap += 1;
      actions.push({ type: "swap", a: i, b: minIndex });
    }
  }

  actions.push({ type: "done" });
  return { actions, sorted, counts };
}
