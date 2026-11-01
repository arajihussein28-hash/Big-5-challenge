/**
 * Challenge mode. The algorithm's recorded actions that carry a `decision`
 * are the moments where the player makes the choice. A wrong click counts as
 * a mistake, and it never changes the algorithm's operation counts.
 */

const QUESTIONS = {
  logn: "Which chest is the middle of the remaining range?",
  on: "Which room should be checked next?",
  onlogn: "Which of the two front crystals belongs next?",
  on2: "Which coin is the smallest one that is left?",
};

const WRONG_HINTS = {
  index: "Not quite. Look at what is still in play and try again.",
  side: "Not that one. The smaller of the two front crystals goes next.",
};

/**
 * @param {{type: string, decision?: {kind: string, answer: unknown}}[]} actions
 * @param {{levelId?: string, values?: number[]}} [context] needed for level-specific messages
 */
export function buildChallenge(actions, { levelId = "", values = [] } = {}) {
  const decisions = [];
  actions.forEach((action, step) => {
    if (action.decision) {
      decisions.push({ step, kind: action.decision.kind, answer: action.decision.answer });
    }
  });
  return { decisions, position: 0, mistakes: 0, levelId, values };
}

/** @returns {{step: number, kind: string, answer: unknown} | null} */
export function currentDecision(challenge) {
  return challenge.decisions[challenge.position] ?? null;
}

export function isChallengeDone(challenge) {
  return challenge.position >= challenge.decisions.length;
}

function correctMessage(challenge, decision) {
  if (challenge.levelId !== "o1") return "Correct!";
  const value = challenge.values[decision.answer];
  return `Correct! items[${decision.answer}] = ${value}. That was 1 array read, so this step costs O(1).`;
}

function wrongMessage(challenge, decision, choice) {
  if (challenge.levelId !== "o1") return WRONG_HINTS[decision.kind];
  const clicked = challenge.values[choice];
  return `Wrong slot. You clicked index ${choice}, which holds ${clicked}. The target is index ${decision.answer}. Use the small index number, not the value inside the box.`;
}

/**
 * Checks the player's choice against the algorithm's correct answer.
 * @param {object} challenge
 * @param {number | "left" | "right"} choice
 * @returns {{correct: boolean, challenge: object, message: string}}
 */
export function judgeChoice(challenge, choice) {
  const decision = currentDecision(challenge);
  if (!decision) {
    return { correct: false, challenge, message: "The challenge is already complete." };
  }
  if (decision.answer === choice) {
    return {
      correct: true,
      challenge: { ...challenge, position: challenge.position + 1 },
      message: correctMessage(challenge, decision),
    };
  }
  return {
    correct: false,
    challenge: { ...challenge, mistakes: challenge.mistakes + 1 },
    message: wrongMessage(challenge, decision, choice),
  };
}

/**
 * The step where the player must decide next, or the end of the run.
 * Everything before that step plays automatically.
 * @param {{decision?: unknown}[]} actions
 * @param {number} fromStep
 */
export function nextStopStep(actions, fromStep) {
  for (let step = fromStep; step < actions.length; step += 1) {
    if (actions[step].decision) return step;
  }
  return actions.length;
}

/**
 * @param {string} levelId
 * @param {{kind: string, answer: unknown} | null} [decision] the current decision, if any
 */
export function questionFor(levelId, decision = null) {
  if (levelId === "o1" && decision) {
    return `Find items[${decision.answer}]. Click the box at index ${decision.answer}.`;
  }
  return QUESTIONS[levelId] ?? "Make the next decision.";
}

/** @param {number} mistakes */
export function starsFor(mistakes) {
  if (mistakes === 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}
