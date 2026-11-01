import { LEVELS, getLevel, mulberry32, comparisonFor } from "./levels.js";
import { createFrame, applyAction, loadProgress, saveProgress, markCompleted } from "./game-state.js";
import { CANVAS, drawFrame, indexAt, playTone } from "./renderer.js";
import {
  buildChallenge,
  currentDecision,
  isChallengeDone,
  judgeChoice,
  questionFor,
  starsFor,
} from "./challenges.js";

const SOUND_KEY = "bigOQuest.sound";
const SPEED_MS = { slow: 900, normal: 450, fast: 150 };
const ANIMATION_MS = 320;
const SIZES = [4, 8, 16, 32];
const COUNTER_KEYS = {
  o1: ["access"],
  logn: ["check"],
  on: ["check"],
  onlogn: ["compare", "write"],
  on2: ["compare", "swap"],
};
const COUNTER_LABELS = {
  access: "Array reads (correct only)",
  check: "Checks",
  compare: "Comparisons",
  write: "Writes",
  swap: "Swaps",
};
const TONES = { access: 520, check: 520, compare: 440, "merge-compare": 440, write: 330, swap: 300, found: 880, done: 880 };

const $ = (id) => document.getElementById(id);
const canvas = $("scene");
const ctx = canvas.getContext("2d");

/** Used when the browser blocks localStorage. Progress then lasts only for this visit. */
function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function openStorage() {
  try {
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

const storage = openStorage();

function readSoundPreference() {
  try {
    return storage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

let state = {
  progress: loadProgress(storage),
  soundOn: readSoundPreference(),
  levelId: LEVELS[0].id,
  n: 8,
  mode: "learn",
  speed: "normal",
  run: null,
  frame: null,
  step: 0,
  challenge: null,
  playing: false,
  waiting: false,
  completedRun: false,
  feedback: "",
  animFrame: 0,
};

let timerId = null;

function setState(patch) {
  state = { ...state, ...patch };
}

function completedCount() {
  return LEVELS.filter((level) => state.progress.completed[level.id]).length;
}

function showScreen(name) {
  for (const section of document.querySelectorAll(".screen")) {
    section.hidden = section.id !== name;
  }
  window.scrollTo(0, 0);
}

function renderDoors() {
  const items = LEVELS.map((level) => {
    const done = Boolean(state.progress.completed[level.id]);
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = done ? "door door-done" : "door";
    button.dataset.level = level.id;

    const complexity = document.createElement("span");
    complexity.className = "door-complexity";
    complexity.textContent = level.complexity;

    const title = document.createElement("span");
    title.className = "door-title";
    title.textContent = done ? `${level.title}  ✓` : level.title;

    button.append(complexity, title);
    button.addEventListener("click", () => openLevel(level.id));
    item.append(button);
    return item;
  });
  $("doors").replaceChildren(...items);
  $("progress-text").textContent = `${completedCount()} of ${LEVELS.length} challenges complete`;
}

function openLevel(levelId) {
  stopTimer();
  setState({ levelId });
  const level = getLevel(levelId);
  $("level-title").textContent = level.title;
  $("level-complexity").textContent = level.complexity;
  $("instructions").textContent = level.instructions;
  $("operation-label").textContent = level.operationLabel;
  $("note").textContent = level.note;
  showScreen("game");
  newRun();
}

function newRun() {
  stopTimer();
  const level = getLevel(state.levelId);
  const seed = Math.floor(Math.random() * 2 ** 32);
  const run = level.run(state.n, mulberry32(seed));
  setState({
    run,
    frame: createFrame(run.values),
    step: 0,
    playing: false,
    waiting: false,
    completedRun: false,
    feedback: "",
    challenge: state.mode === "challenge" ? buildChallenge(run.actions, { levelId: level.id, values: run.values }) : null,
  });
  renderAll();
}

function startTimer() {
  clearTimer();
  setState({ playing: true });
  timerId = setInterval(advance, SPEED_MS[state.speed]);
}

/** Stops the animation timer without changing whether the player wants it running. */
function clearTimer() {
  if (timerId !== null) clearInterval(timerId);
  timerId = null;
}

function stopTimer() {
  clearTimer();
  setState({ playing: false });
}

function playActionSound(type) {
  if (state.soundOn && TONES[type]) playTone(TONES[type]);
}

/** Applies the next recorded action to the frame. */
function applyNext() {
  const action = state.run.actions[state.step];
  playActionSound(action.type);
  setState({ frame: applyAction(state.frame, action), step: state.step + 1 });
}

function isFinished() {
  return state.frame.finished || state.step >= state.run.actions.length;
}

/** One timer tick: apply one action, or pause at a challenge decision. */
function advance() {
  if (!state.run || state.waiting) return;
  const action = state.run.actions[state.step];
  if (state.mode === "challenge" && action?.decision) {
    clearTimer();
    setState({ waiting: true });
    renderAll();
    return;
  }
  if (action) applyNext();
  if (isFinished()) finishRun();
  renderAll();
}

function finishRun() {
  stopTimer();
  if (state.challenge && isChallengeDone(state.challenge) && !state.completedRun) {
    const progress = markCompleted(state.progress, state.levelId);
    saveProgress(storage, progress);
    setState({ progress, completedRun: true });
    renderDoors();
  }
}

/** Learn mode: the Next step button. */
function stepOnce() {
  if (!state.run || isFinished()) return;
  stopTimer();
  applyNext();
  if (isFinished()) finishRun();
  renderAll();
}

/**
 * Challenge mode: the player answers a decision.
 * @param {number | "left" | "right"} choice
 */
function choose(choice) {
  if (!state.waiting || !state.challenge) return;
  const result = judgeChoice(state.challenge, choice);
  setState({ challenge: result.challenge, feedback: result.message });
  if (!result.correct) {
    playTone(150);
    renderAll();
    return;
  }
  playTone(660);
  setState({ waiting: false });
  applyNext();
  if (isFinished()) finishRun();
  else if (state.playing) startTimer();
  renderAll();
}

function renderAll() {
  if (!state.frame || !state.run) return;
  const level = getLevel(state.levelId);
  drawFrame(ctx, state.frame, {
    shape: level.kind === "sort" ? "coin" : "chest",
    hideValues: level.hideValues,
    pose: state.playing && !state.waiting ? "walk" : "idle",
    animFrame: state.animFrame,
  });
  $("caption").textContent = state.frame.caption;
  $("feedback").textContent = state.feedback;
  renderCounters(level);
  renderQuestion(level);
  renderControls();
  const finished = isFinished();
  $("result").hidden = !finished;
  if (finished) renderResult(level);
}

function renderCounters(level) {
  const items = COUNTER_KEYS[level.id].flatMap((key) => {
    const term = document.createElement("dt");
    term.textContent = COUNTER_LABELS[key];
    const value = document.createElement("dd");
    value.textContent = String(state.frame.counts[key]);
    return [term, value];
  });
  if (state.challenge) {
    const term = document.createElement("dt");
    term.textContent = "Mistakes";
    const value = document.createElement("dd");
    value.textContent = String(state.challenge.mistakes);
    items.push(term, value);
  }
  $("counters").replaceChildren(...items);
}

function renderQuestion(level) {
  const decision = state.waiting && state.challenge ? currentDecision(state.challenge) : null;
  const question = $("question");
  question.hidden = !decision;
  if (decision) {
    const hint = decision.kind === "index" && level.id !== "o1" ? " Click the item on the screen." : "";
    question.textContent = `${questionFor(level.id, decision)}${hint}`;
  }
  $("legend").hidden = level.id !== "o1";
  const action = state.run.actions[state.step];
  const showChoices = decision?.kind === "side";
  $("choices").hidden = !showChoices;
  if (showChoices && action) {
    $("choice-left").textContent = `Take left (${action.left})`;
    $("choice-right").textContent = `Take right (${action.right})`;
  }
}

function startLabel() {
  if (state.waiting) return "Your move";
  return state.playing ? "Running" : "Start";
}

function renderControls() {
  const isChallenge = state.mode === "challenge";
  const finished = isFinished();
  $("start-button").textContent = startLabel();
  $("start-button").disabled = finished || state.playing;
  $("pause-button").disabled = !state.playing;
  $("step-button").disabled = isChallenge || finished || state.playing;
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  }
  $("size-select").value = String(state.n);
  $("speed-select").value = state.speed;
}

function summaryText(level) {
  const total = Object.values(state.frame.counts).reduce((sum, count) => sum + count, 0);
  if (state.challenge && isChallengeDone(state.challenge)) {
    const { mistakes } = state.challenge;
    return `Challenge complete with ${mistakes} mistake${mistakes === 1 ? "" : "s"}. Rating: ${"★".repeat(starsFor(mistakes))}${"☆".repeat(3 - starsFor(mistakes))}. This run counted ${total} operations.`;
  }
  return `This run counted ${total} operation${total === 1 ? "" : "s"} on ${level.operationLabel.toLowerCase()}.`;
}

function renderResult(level) {
  const n = state.n;
  const before = comparisonFor(level.id, n);
  const after = comparisonFor(level.id, n * 2);
  $("result-summary").textContent = summaryText(level);
  $("result-text").textContent = `${level.explanation} ${level.note}`;
  $("compare-table").replaceChildren(buildTableHead(n), ...before.map((row, i) => buildTableRow(row, after[i], n)));
  const atLargest = n >= SIZES.at(-1);
  $("double-button").disabled = atLargest;
  $("double-button").textContent = atLargest ? "Largest n reached" : `Try a bigger n (n = ${n * 2})`;
}

function buildTableHead(n) {
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  for (const label of ["Method", "Complexity", `Operations at n = ${n}`, `At n = ${n * 2}`, "Growth"]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    row.append(cell);
  }
  head.append(row);
  return head;
}

function describeOperations(row) {
  if (row.comparisons === undefined) return `${row.detail}`;
  const extra = row.writes !== undefined ? `${row.writes} writes` : `${row.swaps} swaps`;
  return `${row.comparisons} comparisons, ${extra}`;
}

function buildTableRow(smaller, larger, n) {
  const row = document.createElement("tr");
  const growth = smaller.operations === 0 ? "-" : `×${(larger.operations / smaller.operations).toFixed(1)}`;
  const cells = [
    smaller.name,
    smaller.complexity,
    `${smaller.operations} (${describeOperations(smaller)})`,
    `${larger.operations} (${describeOperations(larger)})`,
    growth,
  ];
  for (const text of cells) {
    const cell = document.createElement("td");
    cell.textContent = text;
    row.append(cell);
  }
  return row;
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) * CANVAS.width) / rect.width;
  const y = ((event.clientY - rect.top) * CANVAS.height) / rect.height;
  const index = indexAt(x, y, state.n);
  const decision = state.waiting && state.challenge ? currentDecision(state.challenge) : null;
  if (decision?.kind === "index" && index >= 0) choose(index);
}

function firstUnfinishedLevelId() {
  return LEVELS.find((level) => !state.progress.completed[level.id])?.id ?? LEVELS[0].id;
}

function setMode(mode) {
  setState({ mode });
  newRun();
}

function setSize(n) {
  setState({ n });
  newRun();
}

function toggleSound() {
  const soundOn = !state.soundOn;
  setState({ soundOn });
  try {
    storage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch {
    // Storage is blocked. The choice lasts for this visit.
  }
  renderSound();
}

function renderSound() {
  $("sound-button").textContent = `Sound: ${state.soundOn ? "on" : "off"}`;
  $("sound-button").setAttribute("aria-pressed", String(state.soundOn));
}

function wireControls() {
  $("play-button").addEventListener("click", () => openLevel(firstUnfinishedLevelId()));
  $("howto-button").addEventListener("click", () => showScreen("howto"));
  $("sound-button").addEventListener("click", toggleSound);
  for (const button of document.querySelectorAll("[data-back]")) {
    button.addEventListener("click", () => {
      stopTimer();
      showScreen(button.dataset.back);
      renderDoors();
    });
  }
  $("back-button").addEventListener("click", () => {
    stopTimer();
    showScreen("menu");
    renderDoors();
  });
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }
  $("size-select").addEventListener("change", (event) => setSize(Number(event.target.value)));
  $("speed-select").addEventListener("change", (event) => {
    setState({ speed: event.target.value });
    if (state.playing) startTimer();
  });
  $("start-button").addEventListener("click", () => {
    if (!state.run || state.playing || isFinished()) return;
    startTimer();
    renderAll();
  });
  $("pause-button").addEventListener("click", () => {
    stopTimer();
    renderAll();
  });
  $("step-button").addEventListener("click", stepOnce);
  $("reset-button").addEventListener("click", newRun);
  $("choice-left").addEventListener("click", () => choose("left"));
  $("choice-right").addEventListener("click", () => choose("right"));
  $("double-button").addEventListener("click", () => setSize(state.n * 2));
  canvas.addEventListener("click", handleCanvasClick);
  $("speed-select").value = state.speed;
}

function init() {
  wireControls();
  renderDoors();
  renderSound();
  showScreen("menu");
  setInterval(() => {
    setState({ animFrame: 1 - state.animFrame });
    if (!$("game").hidden) renderAll();
  }, ANIMATION_MS);
}

init();
