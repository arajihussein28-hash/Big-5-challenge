/**
 * Draws a frame onto the canvas. Every sprite is built from small rectangles
 * ("pixels"), so the game needs no image files. One sprite pixel is `u`
 * canvas pixels, and `u` shrinks when there are many items.
 */

export const CANVAS = { width: 800, height: 340 };

const COLORS = {
  wall: "#2a2d4a",
  brick: "#3a3e63",
  floorA: "#3b3a52",
  floorB: "#34334a",
  chestDark: "#4a2f14",
  chestBody: "#8b5a2b",
  chestLid: "#b07236",
  gold: "#ffd166",
  interior: "#2b1a0c",
  skin: "#ffcc99",
  hair: "#3b2a1a",
  shirt: "#2ec4b6",
  pants: "#355070",
  coinEdge: "#c98a1b",
  coin: "#f4b942",
  checked: "#ffd166",
  active: "#5ce1e6",
  scan: "#ff9f1c",
  min: "#7bd389",
  placed: "#3f8f5a",
  eliminated: "rgba(0, 0, 0, 0.55)",
  text: "#f5f5f5",
  label: "#b8bcd9",
  indexLabel: "#5ce1e6",
};

const SPRITE_UNITS = 16;
const MARGIN = 40;
const MAX_UNIT = 3;

/**
 * @param {number} n number of items in the row
 */
export function layoutFor(n) {
  const spacing = (CANVAS.width - MARGIN * 2) / n;
  const unit = Math.max(1, Math.min(MAX_UNIT, Math.floor(spacing / SPRITE_UNITS)));
  return { n, spacing, unit, rowY: 130, tempY: 262 };
}

/** @returns {number} canvas x of the centre of item i */
function centerX(layout, i) {
  return MARGIN + layout.spacing * (i + 0.5);
}

/**
 * @param {number} x canvas x
 * @param {number} y canvas y
 * @param {number} n items in the row
 * @returns {number} the item under the point, or -1
 */
export function indexAt(x, y, n) {
  const layout = layoutFor(n);
  const half = (SPRITE_UNITS * layout.unit) / 2;
  if (Math.abs(y - layout.rowY) > half) return -1;
  const index = Math.floor((x - MARGIN) / layout.spacing);
  return index >= 0 && index < n ? index : -1;
}

/** Draws one rectangle in sprite units, with its top-left at (x0, y0). */
function px(ctx, x0, y0, u, gx, gy, gw, gh, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x0 + gx * u, y0 + gy * u, gw * u, gh * u);
}

function drawWallAndFloor(ctx) {
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, CANVAS.width, 70);
  for (let row = 0; row < 4; row += 1) {
    for (let col = -1; col < CANVAS.width / 40; col += 1) {
      const offset = row % 2 === 0 ? 0 : 20;
      ctx.fillStyle = COLORS.brick;
      ctx.fillRect(col * 40 + offset + 1, row * 17 + 1, 38, 15);
    }
  }
  for (let row = 0; row < CANVAS.height / 40; row += 1) {
    for (let col = 0; col < CANVAS.width / 40; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(col * 40, 70 + row * 40, 40, 40);
    }
  }
}

function drawChest(ctx, x, y, u, open) {
  px(ctx, x, y, u, 1, 7, 14, 9, COLORS.chestBody);
  px(ctx, x, y, u, 1, 3, 14, 4, COLORS.chestLid);
  px(ctx, x, y, u, 0, 7, 1, 9, COLORS.chestDark);
  px(ctx, x, y, u, 15, 7, 1, 9, COLORS.chestDark);
  px(ctx, x, y, u, 1, 15, 14, 1, COLORS.chestDark);
  if (open) {
    px(ctx, x, y, u, 1, 0, 14, 3, COLORS.chestLid);
    px(ctx, x, y, u, 2, 7, 12, 2, COLORS.interior);
    px(ctx, x, y, u, 4, 6, 8, 1, COLORS.gold);
  } else {
    px(ctx, x, y, u, 7, 8, 2, 3, COLORS.gold);
  }
}

function drawCoin(ctx, x, y, u, color) {
  const radius = 6;
  for (let gy = 0; gy < radius * 2; gy += 1) {
    const dy = gy - radius + 0.5;
    const half = Math.round(Math.sqrt(radius * radius - dy * dy));
    px(ctx, x, y, u, radius - half, gy, half * 2, 1, color);
  }
  px(ctx, x, y, u, 2, 2, 2, 1, "#ffffff");
}

function drawKey(ctx, x, y, u) {
  px(ctx, x, y, u, 0, 2, 5, 5, COLORS.gold);
  px(ctx, x, y, u, 1, 3, 3, 3, COLORS.interior);
  px(ctx, x, y, u, 5, 3, 9, 2, COLORS.gold);
  px(ctx, x, y, u, 11, 5, 2, 2, COLORS.gold);
}

/**
 * Pixel character, 8 x 14 sprite units. Poses: idle, walk, celebrate.
 * @param {"idle" | "walk" | "celebrate"} pose
 * @param {number} frame animation frame (0 or 1), used by walk
 */
function drawCharacter(ctx, cx, bottomY, u, pose, frame) {
  const x = cx - 4 * u;
  const y = bottomY - 14 * u;
  px(ctx, x, y, u, 2, 0, 4, 4, COLORS.skin);
  px(ctx, x, y, u, 2, 0, 4, 1, COLORS.hair);
  px(ctx, x, y, u, 3, 2, 1, 1, COLORS.interior);
  px(ctx, x, y, u, 5, 2, 1, 1, COLORS.interior);
  px(ctx, x, y, u, 1, 5, 6, 5, COLORS.shirt);
  if (pose === "celebrate") {
    px(ctx, x, y, u, 0, 0, 1, 4, COLORS.shirt);
    px(ctx, x, y, u, 7, 0, 1, 4, COLORS.shirt);
  } else {
    px(ctx, x, y, u, 0, 5, 1, 4, COLORS.shirt);
    px(ctx, x, y, u, 7, 5, 1, 4, COLORS.shirt);
  }
  const stepping = pose === "walk" && frame === 1;
  px(ctx, x, y, u, 2, 10, 2, stepping ? 3 : 4, COLORS.pants);
  px(ctx, x, y, u, 5, 10, 2, stepping ? 4 : 3, COLORS.pants);
}

function drawItemFrame(ctx, cx, rowY, u, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, u);
  const half = (SPRITE_UNITS * u) / 2 + u;
  ctx.strokeRect(cx - half, rowY - half, half * 2, half * 2);
}

function drawMark(ctx, cx, rowY, u, mark) {
  if (mark === "checked") drawItemFrame(ctx, cx, rowY, u, COLORS.checked);
  if (mark === "active") drawItemFrame(ctx, cx, rowY, u, COLORS.active);
  if (mark === "scan") drawItemFrame(ctx, cx, rowY, u, COLORS.scan);
  if (mark === "min") drawItemFrame(ctx, cx, rowY, u, COLORS.min);
  if (mark === "found") drawItemFrame(ctx, cx, rowY, u, COLORS.gold);
  if (mark === "placed") {
    ctx.fillStyle = COLORS.placed;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(cx - SPRITE_UNITS * u * 0.5, rowY - SPRITE_UNITS * u * 0.5, SPRITE_UNITS * u, SPRITE_UNITS * u);
    ctx.globalAlpha = 1;
  }
  if (mark === "eliminated") {
    ctx.fillStyle = COLORS.eliminated;
    ctx.fillRect(cx - SPRITE_UNITS * u * 0.5, rowY - SPRITE_UNITS * u * 0.5, SPRITE_UNITS * u, SPRITE_UNITS * u);
  }
}

function drawLabel(ctx, text, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text), x, y);
}

/** Draws one item (chest, coin, or room) with its value, mark, and slot number. */
function drawItem(ctx, layout, index, value, mark, options) {
  const { unit: u, rowY } = layout;
  const cx = centerX(layout, index);
  const x = cx - (SPRITE_UNITS * u) / 2;
  const y = rowY - (SPRITE_UNITS * u) / 2;
  const showValue = !options.hideValues || mark === "checked" || mark === "found";

  if (options.shape === "coin") {
    drawCoin(ctx, x + 2 * u, y + 2 * u, u, COLORS.coin);
  } else {
    drawChest(ctx, x, y, u, mark === "found");
  }
  drawMark(ctx, cx, rowY, u, mark);

  if (showValue) {
    drawLabel(ctx, value, cx, rowY + 1, Math.max(10, 6 + u * 4), COLORS.text);
  } else {
    drawLabel(ctx, "?", cx, rowY + 1, Math.max(10, 6 + u * 4), COLORS.label);
  }
  drawLabel(ctx, `[${index}]`, cx, rowY + SPRITE_UNITS * u * 0.5 + 12, 12, COLORS.indexLabel);
}

function drawGroups(ctx, layout, groups) {
  ctx.strokeStyle = COLORS.label;
  ctx.lineWidth = 2;
  for (const [from, to] of groups) {
    const left = centerX(layout, from) - layout.spacing / 2 + 4;
    const right = centerX(layout, to - 1) + layout.spacing / 2 - 4;
    const y = layout.rowY - SPRITE_UNITS * layout.unit * 0.5 - 14;
    ctx.beginPath();
    ctx.moveTo(left, y + 6);
    ctx.lineTo(left, y);
    ctx.lineTo(right, y);
    ctx.lineTo(right, y + 6);
    ctx.stroke();
  }
}

/** The two halves waiting to be merged, drawn under the positions they came from. */
function drawTemp(ctx, layout, temp) {
  const { unit: u, tempY } = layout;
  temp.left.forEach((value, k) => {
    const cx = centerX(layout, temp.from + k);
    drawCoin(ctx, cx - 6 * u, tempY - 6 * u, u, k === temp.li ? COLORS.active : COLORS.coinEdge);
    drawLabel(ctx, value, cx, tempY, Math.max(10, 6 + u * 3), COLORS.text);
  });
  temp.right.forEach((value, k) => {
    const cx = centerX(layout, temp.from + temp.left.length + k);
    drawCoin(ctx, cx - 6 * u, tempY - 6 * u, u, k === temp.ri ? COLORS.active : COLORS.coinEdge);
    drawLabel(ctx, value, cx, tempY, Math.max(10, 6 + u * 3), COLORS.text);
  });
  drawLabel(ctx, "halves waiting to merge", MARGIN, tempY + 26, 11, COLORS.label);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} frame from game-state.js
 * @param {{shape: "chest" | "coin", hideValues: boolean, pose: string, animFrame: number}} options
 */
export function drawFrame(ctx, frame, options) {
  const layout = layoutFor(frame.values.length);
  ctx.imageSmoothingEnabled = false;
  drawWallAndFloor(ctx);
  drawGroups(ctx, layout, frame.groups);

  frame.values.forEach((value, i) => {
    drawItem(ctx, layout, i, value, frame.marks[i], options);
  });

  if (frame.temp) drawTemp(ctx, layout, frame.temp);

  if (frame.character !== null) {
    const pose = frame.finished && frame.found >= 0 ? "celebrate" : options.pose;
    const cx = centerX(layout, frame.character);
    drawCharacter(ctx, cx, layout.rowY - (SPRITE_UNITS * layout.unit) / 2 - 6, layout.unit, pose, options.animFrame);
  }
  if (frame.found >= 0) {
    const cx = centerX(layout, frame.found);
    drawKey(ctx, cx + 4 * layout.unit, layout.rowY - (SPRITE_UNITS * layout.unit) / 2 - 16, Math.max(1, layout.unit - 1));
  }
}

let audioContext = null;

/**
 * Short beep for feedback. Silently does nothing if audio is unavailable.
 * @param {number} frequency in hertz
 * @param {number} durationMs
 */
export function playTone(frequency, durationMs = 90) {
  try {
    audioContext = audioContext ?? new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + durationMs / 1000);
  } catch {
    // Audio is blocked or missing. The game stays playable without sound.
  }
}
