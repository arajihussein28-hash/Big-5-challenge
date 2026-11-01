/**
 * A frame is the picture the screen shows after some actions have been
 * replayed. Frames are never changed in place: applyAction returns a new one.
 */

export const PROGRESS_KEY = "bigOQuest.progress";

/** @returns {{access: number, check: number, compare: number, write: number, swap: number}} */
function zeroCounts() {
  return { access: 0, check: 0, compare: 0, write: 0, swap: 0 };
}

/**
 * @param {unknown[]} values
 * @returns {object} a frame showing the starting values
 */
export function createFrame(values) {
  return {
    values: [...values],
    marks: values.map(() => null),
    groups: [],
    temp: null,
    character: null,
    caption: "",
    counts: zeroCounts(),
    finished: false,
    found: -1,
  };
}

/** Removes the marks that only last for one step. */
function clearTemporary(marks) {
  return marks.map((mark) => (mark === "scan" || mark === "min" || mark === "active" ? null : mark));
}

/** The chest that was being checked is now a finished check. */
function settle(marks) {
  return marks.map((mark) => (mark === "active" ? "checked" : mark));
}

function markRange(marks, from, to) {
  return marks.map((mark, i) => {
    if (i < from || i > to) return mark;
    return mark === "found" || mark === "active" ? mark : "eliminated";
  });
}

/**
 * @param {object} frame
 * @param {{type: string, [key: string]: any}} action
 * @returns {object} the next frame
 */
export function applyAction(frame, action) {
  switch (action.type) {
    case "access": {
      const marks = clearTemporary(frame.marks);
      marks[action.index] = "active";
      return {
        ...frame,
        marks,
        character: action.index,
        counts: { ...frame.counts, access: frame.counts.access + 1 },
        caption: `Read items[${action.index}] = ${frame.values[action.index]}`,
      };
    }
    case "check": {
      const marks = settle(frame.marks);
      marks[action.index] = "active";
      return {
        ...frame,
        marks,
        character: action.index,
        counts: { ...frame.counts, check: frame.counts.check + 1 },
        caption: `Checking position ${action.index}`,
      };
    }
    case "eliminate":
      return { ...frame, marks: markRange(settle(frame.marks), action.from, action.to), caption: "Ruled out. Those are darker now." };
    case "found": {
      const marks = settle(frame.marks);
      marks[action.index] = "found";
      // A single slot read already explains itself in the caption, so keep it.
      const caption = frame.counts.access > 0 ? frame.caption : "Found it!";
      return { ...frame, marks, finished: true, found: action.index, character: action.index, caption };
    }
    case "notFound":
      return { ...frame, marks: settle(frame.marks), finished: true, caption: "Not in the list." };
    case "pass":
      return applyPass(frame, action.index);
    case "compare":
      return applySelectionCompare(frame, action);
    case "swap": {
      const values = [...frame.values];
      [values[action.a], values[action.b]] = [values[action.b], values[action.a]];
      return {
        ...frame,
        values,
        marks: clearTemporary(frame.marks),
        counts: { ...frame.counts, swap: frame.counts.swap + 1 },
        caption: `Swap ${action.a} and ${action.b}`,
      };
    }
    case "split":
      return { ...frame, groups: [...frame.groups, [action.from, action.to]], caption: "Split into two halves" };
    case "merge-start":
      return {
        ...frame,
        temp: { from: action.from, to: action.to, left: action.left, right: action.right, li: 0, ri: 0 },
        caption: "Merge the two sorted halves",
      };
    case "merge-compare":
      return {
        ...frame,
        temp: { ...frame.temp, li: action.li, ri: action.ri },
        counts: { ...frame.counts, compare: frame.counts.compare + 1 },
        caption: `${Math.min(action.left, action.right)} is smaller, so it goes next`,
      };
    case "write": {
      const values = [...frame.values];
      values[action.index] = action.value;
      return { ...frame, values, counts: { ...frame.counts, write: frame.counts.write + 1 } };
    }
    case "merge-end":
      return {
        ...frame,
        temp: null,
        groups: frame.groups.filter(([from, to]) => !(from === action.from && to === action.to)),
      };
    case "done":
      return { ...frame, marks: frame.values.map(() => "placed"), finished: true, caption: "All in order" };
    default:
      return frame;
  }
}

function applyPass(frame, index) {
  const marks = frame.values.map((_, i) => (i < index ? "placed" : null));
  marks[index] = "active";
  return {
    ...frame,
    marks,
    character: index,
    caption: `Pass ${index + 1}: find the smallest coin that is left`,
  };
}

function applySelectionCompare(frame, action) {
  const marks = clearTemporary(frame.marks);
  marks[action.index] = "scan";
  if (action.min !== action.index) marks[action.min] = "min";
  return {
    ...frame,
    marks,
    character: action.index,
    counts: { ...frame.counts, compare: frame.counts.compare + 1 },
    caption: `Is ${frame.values[action.index]} smaller than ${frame.values[action.min]}?`,
  };
}

/**
 * Replays the first `step` actions on the starting values.
 * @param {unknown[]} values
 * @param {{type: string}[]} actions
 * @param {number} step
 */
export function frameAt(values, actions, step) {
  return actions.slice(0, step).reduce(applyAction, createFrame(values));
}

/**
 * @param {{completed: Record<string, boolean>}} progress
 * @param {string} levelId
 */
export function markCompleted(progress, levelId) {
  return { ...progress, completed: { ...progress.completed, [levelId]: true } };
}

/**
 * Reads saved progress. Storage can be blocked (private windows, disabled
 * site data), so any failure falls back to empty progress for this visit.
 * @param {Storage} storage
 */
export function loadProgress(storage) {
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (!raw) return { completed: {} };
    const parsed = JSON.parse(raw);
    return { completed: { ...(parsed.completed ?? {}) } };
  } catch {
    return { completed: {} };
  }
}

/**
 * @param {Storage} storage
 * @param {{completed: Record<string, boolean>}} progress
 * @returns {boolean} whether the save worked
 */
export function saveProgress(storage, progress) {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
