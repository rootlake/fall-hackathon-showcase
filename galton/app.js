// Statistics lab: a Galton board.
// Each peg row is one left-or-right bounce. Bin k means k right bounces.
// A fair run is compared with the binomial model C(n, k) / 2^n.

const {
  Engine,
  Render,
  Runner,
  Bodies,
  Body,
  Composite,
  Events
} = Matter;

const WIDTH = 880;
const HEIGHT = 760;
const MAX_BALLS = 140;
const SPAWN_GAP = 90;
const BALL_COLORS = ["#9d3418", "#1c4f45", "#2a4470", "#8a5a08", "#6d3a48"];

const state = {
  rows: 8,
  wind: 0,
  runWind: 0,
  mixed: false,
  showExpected: true,
  paused: false,
  queue: 0,
  balls: [],
  pegs: [],
  nextSpawn: 0,
  notice: ""
};

const els = {
  board: document.getElementById("board"),
  boardMeta: document.getElementById("boardMeta"),
  runState: document.getElementById("runState"),
  notice: document.getElementById("notice"),
  rows: document.getElementById("rows"),
  rowsOut: document.getElementById("rowsOut"),
  wind: document.getElementById("wind"),
  windOut: document.getElementById("windOut"),
  expected: document.getElementById("expected"),
  settled: document.getElementById("statSettled"),
  settledSub: document.getElementById("statSettledSub"),
  mean: document.getElementById("statMean"),
  meanSub: document.getElementById("statMeanSub"),
  sd: document.getElementById("statSd"),
  sdSub: document.getElementById("statSdSub"),
  fourthLabel: document.getElementById("statFourthLabel"),
  fourth: document.getElementById("statFourth"),
  fourthSub: document.getElementById("statFourthSub"),
  insight: document.getElementById("insight"),
  chart: document.getElementById("chart"),
  why: document.getElementById("why"),
  formula: document.getElementById("formula"),
  pause: document.getElementById("pause")
};

let metrics = computeMetrics(state.rows);
let chartCells = [];

const engine = Engine.create({
  enableSleeping: false,
  positionIterations: 8,
  velocityIterations: 6,
  gravity: { x: 0, y: 1, scale: 0.00105 }
});

const render = Render.create({
  element: els.board,
  engine,
  options: {
    width: WIDTH,
    height: HEIGHT,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    background: "#f3eee4",
    wireframes: false,
    showSleeping: false
  }
});

const runner = Runner.create();
render.canvas.setAttribute("role", "img");
render.canvas.setAttribute("aria-label", "Galton board. Balls fall through pegs into bins.");

Runner.run(runner, engine);
Render.run(render);
Events.on(engine, "beforeUpdate", onBeforeUpdate);
Events.on(engine, "afterUpdate", onAfterUpdate);
Events.on(render, "afterRender", drawBoard);

rebuild();
setInterval(paintHud, 120);

document.getElementById("drop1").addEventListener("click", () => drop(1));
document.getElementById("drop40").addEventListener("click", () => drop(40));
document.getElementById("drop120").addEventListener("click", () => drop(120));
els.pause.addEventListener("click", () => setPaused(!state.paused));
document.getElementById("reset").addEventListener("click", reset);
els.rows.addEventListener("input", () => {
  els.rowsOut.textContent = els.rows.value;
});
els.rows.addEventListener("change", () => {
  state.rows = Number(els.rows.value);
  rebuild();
  setNotice("Rows changed. The board was cleared.");
});
els.wind.addEventListener("input", () => {
  const next = Number(els.wind.value) / 100;
  state.wind = next;
  if (state.balls.length === 0 && state.queue === 0) {
    state.runWind = next;
    state.mixed = false;
  } else if (Math.abs(next - state.runWind) > 0.08) {
    state.mixed = true;
  }
  paintHud();
});
els.expected.addEventListener("change", () => {
  state.showExpected = els.expected.checked;
  paintHud();
});
render.canvas.addEventListener("click", () => drop(1));
window.addEventListener("keydown", onKey);

function computeMetrics(rows) {
  const bins = rows + 1;
  const marginX = 42;
  const usable = WIDTH - marginX * 2;
  const spacing = usable / bins;
  const left = (WIDTH - spacing * bins) / 2;
  const right = left + spacing * bins;
  const pegR = clamp(spacing * 0.115, 5, 12);
  const ballR = clamp(spacing * 0.08, 5, 8);
  const spawnY = 48;
  const firstPegY = 96;
  const floorY = HEIGHT - 26;
  const minBinH = 228;
  const gapAfterPeg = pegR + 24;
  const avail = floorY - minBinH - firstPegY - gapAfterPeg;
  // A little extra vertical room keeps each bounce chaotic instead of a fixed ricochet.
  const rowH = Math.min(spacing * 0.74, avail / Math.max(1, rows - 1));
  const lastPegY = firstPegY + rowH * (rows - 1);
  const binTop = lastPegY + gapAfterPeg;
  return {
    rows,
    bins,
    spacing,
    left,
    right,
    centerX: (left + right) / 2,
    pegR,
    ballR,
    spawnY,
    firstPegY,
    rowH,
    lastPegY,
    binTop,
    floorY,
    binH: floorY - binTop
  };
}

function pathCounts(rows) {
  const counts = [1];
  for (let k = 0; k < rows; k += 1) {
    counts.push((counts[k] * (rows - k)) / (k + 1));
  }
  return counts.map((value) => Math.round(value));
}

function rebuild() {
  Composite.clear(engine.world, false);
  Engine.clear(engine);
  state.balls = [];
  state.pegs = [];
  state.queue = 0;
  state.mixed = false;
  state.runWind = state.wind;
  state.nextSpawn = 0;
  metrics = computeMetrics(state.rows);
  buildStatics();
  buildChart();
  paintHud();
}

function buildStatics() {
  const m = metrics;
  const thick = 48;
  const midY = (m.spawnY + m.floorY) / 2;
  const wallH = m.floorY - m.spawnY + 120;
  addStatic(m.left - thick / 2, midY, thick, wallH, "wall");
  addStatic(m.right + thick / 2, midY, thick, wallH, "wall");
  addStatic((m.left + m.right) / 2, m.floorY + thick / 2, m.right - m.left + thick * 2, thick, "floor");

  for (let i = 1; i < m.bins; i += 1) {
    const x = m.left + i * m.spacing;
    const h = m.floorY - m.binTop;
    addStatic(x, m.binTop + h / 2, 5, h, "divider");
  }

  for (let row = 0; row < m.rows; row += 1) {
    const count = row + 1;
    const y = m.firstPegY + row * m.rowH;
    for (let j = 0; j < count; j += 1) {
      const x = m.centerX + (j - (count - 1) / 2) * m.spacing;
      const peg = Bodies.circle(x, y, m.pegR, {
        isStatic: true,
        label: "peg",
        restitution: 0.82,
        friction: 0,
        frictionStatic: 0,
        render: { visible: false }
      });
      Composite.add(engine.world, peg);
      state.pegs.push(peg);
    }
  }
}

function addStatic(x, y, w, h, label) {
  Composite.add(engine.world, Bodies.rectangle(x, y, w, h, {
    isStatic: true,
    label,
    restitution: 0,
    friction: 0.35,
    render: { visible: false }
  }));
}

function drop(count) {
  if (state.paused) setPaused(false);
  const room = MAX_BALLS - state.balls.length - state.queue;
  if (room <= 0) {
    setNotice("The board is full. Reset it before you drop more balls.");
    return;
  }
  const added = Math.min(count, room);
  state.queue += added;
  if (added < count) {
    setNotice("Only " + added + " more balls fit. Reset for a larger run.");
  } else if (!state.mixed) {
    setNotice("");
  }
}

function reset() {
  els.wind.value = "0";
  state.wind = 0;
  if (state.paused) setPaused(false);
  rebuild();
  setNotice("");
}

function setPaused(next) {
  state.paused = next;
  runner.enabled = !next;
  els.pause.textContent = next ? "Resume" : "Pause";
  paintHud();
}

function onKey(event) {
  const tag = event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
  if (event.code === "Space") {
    event.preventDefault();
    setPaused(!state.paused);
  } else if (event.key === "r" || event.key === "R") {
    reset();
  } else if (event.key === "d" || event.key === "D") {
    drop(1);
  }
}

function onBeforeUpdate(event) {
  const m = metrics;
  if (state.queue > 0 && event.timestamp >= state.nextSpawn && spawnClear()) {
    spawnBall();
    state.queue -= 1;
    state.nextSpawn = event.timestamp + SPAWN_GAP;
  }

  for (let i = 0; i < state.balls.length; i += 1) {
    const ball = state.balls[i];
    if (ball.isStatic) continue;

    if (state.wind !== 0) {
      Body.applyForce(ball, ball.position, {
        x: state.wind * 0.000075 * ball.mass,
        y: 0
      });
    }

    const entered = ball.position.y > m.binTop;
    if (entered) {
      ball.restitution = 0;
      ball.friction = 0.7;
      ball.frictionAir = 0.09;
    }

    // A ball that stops on a peg or on a divider lip gets a small push.
    if (!entered && ball.speed < 0.18) {
      ball.galtonStuck = (ball.galtonStuck || 0) + 1;
      if (ball.galtonStuck > 28) {
        Body.applyForce(ball, ball.position, {
          x: (Math.random() - 0.5) * 0.0014 * ball.mass,
          y: 0.00045 * ball.mass
        });
        ball.galtonStuck = 0;
      }
    } else {
      ball.galtonStuck = 0;
    }
  }
}

function onAfterUpdate() {
  const m = metrics;
  for (let i = state.balls.length - 1; i >= 0; i -= 1) {
    const ball = state.balls[i];
    if (ball.position.y > HEIGHT + 60 || ball.position.x < -60 || ball.position.x > WIDTH + 60) {
      Composite.remove(engine.world, ball);
      state.balls.splice(i, 1);
      continue;
    }
    if (ball.galtonSettled) continue;
    const inBin = ball.position.y > m.binTop + m.ballR * 0.2;
    if (inBin && ball.speed < 0.42) {
      ball.galtonStill = (ball.galtonStill || 0) + 1;
      if (ball.galtonStill >= 16) settle(ball);
    } else {
      ball.galtonStill = 0;
    }
  }
}

function spawnClear() {
  const m = metrics;
  const y = m.spawnY;
  const limit = m.ballR * 2.4;
  for (let i = 0; i < state.balls.length; i += 1) {
    const ball = state.balls[i];
    const dx = ball.position.x - m.centerX;
    const dy = ball.position.y - y;
    if (dx * dx + dy * dy < limit * limit) return false;
  }
  return true;
}

function spawnBall() {
  const m = metrics;
  const color = BALL_COLORS[state.balls.length % BALL_COLORS.length];
  const jitter = (Math.random() - 0.5) * m.spacing * 0.16;
  const ball = Bodies.circle(m.centerX + jitter, m.spawnY, m.ballR, {
    label: "ball",
    restitution: 0.35,
    friction: 0.002,
    frictionStatic: 0.01,
    frictionAir: 0.012,
    density: 0.0016,
    render: { visible: false }
  });
  ball.galtonColor = color;
  ball.galtonSettled = false;
  ball.galtonStill = 0;
  Body.setVelocity(ball, {
    x: (Math.random() - 0.5) * 0.55,
    y: 0.15
  });
  Composite.add(engine.world, ball);
  state.balls.push(ball);
}

function settle(ball) {
  ball.galtonSettled = true;
  ball.galtonBin = binIndex(ball.position.x);
  // Park the ball in its bin for real, so the picture and the collisions match.
  repackBin(ball.galtonBin);
}

function repackBin(bin) {
  const group = [];
  for (let i = 0; i < state.balls.length; i += 1) {
    const ball = state.balls[i];
    if (ball.galtonSettled && ball.galtonBin === bin) group.push(ball);
  }
  const m = metrics;
  const radius = m.ballR;
  const step = radius * 2 + 1.6;
  const perRow = Math.max(1, Math.floor((m.spacing - 8) / step));
  const pitch = radius * 2;
  for (let n = 0; n < group.length; n += 1) {
    const row = Math.floor(n / perRow);
    const col = n % perRow;
    const rowCount = Math.min(perRow, group.length - row * perRow);
    const span = rowCount * step;
    const x = m.left + bin * m.spacing + (m.spacing - span) / 2 + col * step + step / 2;
    const y = m.floorY - 4 - radius - row * pitch;
    Body.setPosition(group[n], { x, y });
    Body.setVelocity(group[n], { x: 0, y: 0 });
    if (!group[n].isStatic) Body.setStatic(group[n], true);
  }
}

function binIndex(x) {
  const index = Math.floor((x - metrics.left) / metrics.spacing);
  return clamp(index, 0, metrics.bins - 1);
}

function snapshot() {
  const counts = Array(metrics.bins).fill(0);
  let settled = 0;
  let falling = 0;
  for (let i = 0; i < state.balls.length; i += 1) {
    const ball = state.balls[i];
    if (!ball.galtonSettled) {
      falling += 1;
      continue;
    }
    counts[ball.galtonBin] += 1;
    settled += 1;
  }
  let sum = 0;
  let square = 0;
  for (let k = 0; k < counts.length; k += 1) sum += counts[k] * k;
  const mean = settled ? sum / settled : null;
  if (settled) {
    for (let k = 0; k < counts.length; k += 1) {
      const diff = k - mean;
      square += counts[k] * diff * diff;
    }
  }
  const sd = settled ? Math.sqrt(square / settled) : null;
  const paths = pathCounts(state.rows);
  const totalPaths = 2 ** state.rows;
  const fair = paths.map((count) => count / totalPaths);
  let variation = 0;
  if (settled) {
    for (let k = 0; k < counts.length; k += 1) {
      variation += Math.abs(counts[k] / settled - fair[k]);
    }
    variation *= 0.5;
  }
  return {
    counts,
    settled,
    falling,
    queued: state.queue,
    mean,
    sd,
    fair,
    paths,
    totalPaths,
    fairMean: state.rows / 2,
    fairSd: Math.sqrt(state.rows) / 2,
    agreement: settled ? 1 - variation : null
  };
}

function paintHud() {
  const snap = snapshot();
  const windLabel = describeWind(state.wind);
  els.rowsOut.textContent = String(state.rows);
  els.windOut.textContent = windLabel;
  els.boardMeta.textContent = state.rows + " rows · " + metrics.bins + " bins";
  els.runState.textContent = runLabel(snap);
  els.settled.textContent = String(snap.settled);
  els.settledSub.textContent = snap.falling || snap.queued
    ? snap.falling + " falling · " + snap.queued + " waiting"
    : "of this run";
  els.mean.textContent = snap.mean === null ? "—" : snap.mean.toFixed(1);
  els.meanSub.textContent = "fair " + snap.fairMean.toFixed(1);
  els.sd.textContent = snap.settled < 2 || snap.sd === null ? "—" : snap.sd.toFixed(1);
  els.sdSub.textContent = "fair " + snap.fairSd.toFixed(1);
  paintFourth(snap);
  els.insight.textContent = insight(snap);
  els.why.textContent = whyText(snap);
  els.formula.textContent = "P(bin k) = C(" + state.rows + ", k) / " + snap.totalPaths + ". Bin k counts paths with k right bounces.";
  paintChart(snap);
  if (state.mixed && !els.notice.textContent) {
    setNotice("This run mixes wind settings. Reset, then drop a fresh set.");
  }
}

function paintFourth(snap) {
  const windy = Math.abs(state.runWind) > 0.2 || state.mixed;
  if (state.mixed) {
    els.fourthLabel.textContent = "This run";
    els.fourth.textContent = "Mixed";
    els.fourthSub.textContent = "Reset for a clean comparison";
    return;
  }
  if (windy) {
    els.fourthLabel.textContent = "Shift";
    if (snap.mean === null) {
      els.fourth.textContent = "—";
    } else {
      const shift = snap.mean - snap.fairMean;
      els.fourth.textContent = (shift > 0 ? "+" : "") + shift.toFixed(1);
    }
    els.fourthSub.textContent = "bins from the fair center";
    return;
  }
  els.fourthLabel.textContent = "Agreement";
  if (snap.settled < 20 || snap.agreement === null) {
    els.fourth.textContent = "—";
    els.fourthSub.textContent = "needs 20 settled balls";
  } else {
    els.fourth.textContent = Math.round(snap.agreement * 100) + "%";
    els.fourthSub.textContent = "with the fair model";
  }
}

function insight(snap) {
  if (state.mixed) {
    return "These piles mix more than one wind setting, so do not read them as one experiment.";
  }
  if (Math.abs(state.runWind) > 0.2) {
    return "Side wind is on, so the fair red marks are only a baseline. The pile should drift off the dashed center.";
  }
  if (snap.settled === 0 && snap.falling === 0) {
    return "The red marks are the prediction for a fair board. Drop balls to test it.";
  }
  if (snap.settled < 20) {
    return "A few balls are one small sample. A single trial can land anywhere, so the shape is still noisy.";
  }
  if (snap.settled >= 20 && snap.agreement !== null && snap.agreement >= 0.75) {
    if (snap.sd > snap.fairSd * 1.25) {
      return "The center matches the prediction. The pile is a little wider than a perfect coin-flip model, because real bounces are messier than a fair coin.";
    }
    return "The piles are close to the prediction. The middle wins because more paths lead there.";
  }
  return "The sample is still wobbling around the prediction. More balls should pull it closer.";
}

function whyText(snap) {
  const paths = snap.paths;
  let best = 0;
  for (let i = 1; i < paths.length; i += 1) {
    if (paths[i] > paths[best]) best = i;
  }
  const leaders = [];
  for (let i = 0; i < paths.length; i += 1) {
    if (paths[i] === paths[best]) leaders.push(i);
  }
  const noun = snap.totalPaths === 1 ? "path" : "paths";
  if (leaders.length === 1) {
    return state.rows + " rows make " + snap.totalPaths + " equally likely " + noun + ". Bin " + leaders[0] + " has " + paths[best] + " of them, more than any other bin.";
  }
  return state.rows + " rows make " + snap.totalPaths + " equally likely " + noun + ". Bins " + leaders.join(" and ") + " tie for the most, with " + paths[best] + " each.";
}

function runLabel(snap) {
  if (state.paused) return "Paused";
  if (snap.queued || snap.falling) return "Dropping";
  if (snap.settled) return "Settled";
  return "Ready";
}

function describeWind(wind) {
  if (wind < -0.66) return "Strong left";
  if (wind < -0.2) return "Left";
  if (wind <= 0.2) return "Fair";
  if (wind <= 0.66) return "Right";
  return "Strong right";
}

function buildChart() {
  els.chart.textContent = "";
  els.chart.classList.toggle("dense", metrics.bins > 10);
  chartCells = [];
  for (let k = 0; k < metrics.bins; k += 1) {
    const col = document.createElement("div");
    col.className = "col";
    const plot = document.createElement("div");
    plot.className = "plot";
    const bar = document.createElement("div");
    bar.className = "bar";
    const mark = document.createElement("div");
    mark.className = "mark";
    plot.append(bar, mark);
    const obs = document.createElement("div");
    obs.className = "obs";
    const fair = document.createElement("div");
    fair.className = "fair";
    const path = document.createElement("div");
    path.className = "path";
    const idx = document.createElement("div");
    idx.className = "idx";
    idx.textContent = String(k);
    col.append(plot, obs, fair, path, idx);
    els.chart.appendChild(col);
    chartCells.push({ bar, mark, obs, fair, path, col });
  }
}

function paintChart(snap) {
  let maxP = 0.2;
  for (let k = 0; k < snap.fair.length; k += 1) {
    maxP = Math.max(maxP, snap.fair[k]);
    if (snap.settled) maxP = Math.max(maxP, snap.counts[k] / snap.settled);
  }
  const leader = Math.max(...snap.paths);
  for (let k = 0; k < chartCells.length; k += 1) {
    const cell = chartCells[k];
    const observed = snap.settled ? snap.counts[k] / snap.settled : 0;
    cell.bar.style.height = (observed / maxP) * 100 + "%";
    cell.mark.style.bottom = (snap.fair[k] / maxP) * 100 + "%";
    cell.mark.hidden = !state.showExpected;
    cell.obs.textContent = snap.settled ? formatPct(observed) : "—";
    cell.fair.textContent = state.showExpected ? formatPct(snap.fair[k]) : "";
    cell.path.textContent = String(snap.paths[k]);
    cell.path.style.color = snap.paths[k] === leader ? "#9d3418" : "";
    cell.path.style.fontWeight = snap.paths[k] === leader ? "800" : "";
    cell.col.title = "Bin " + k + ": " + (snap.settled ? formatPct(observed) : "no balls yet") + " this run, " + formatPct(snap.fair[k]) + " fair, " + snap.paths[k] + " paths";
  }
  const summary = snap.settled + " settled balls. Average bin " + (snap.mean === null ? "unknown" : snap.mean.toFixed(1)) + ".";
  els.chart.setAttribute("aria-label", "Bin chart. " + summary);
}

function drawBoard() {
  const ctx = render.context;
  const m = metrics;
  ctx.save();
  ctx.fillStyle = "#e7dfd0";
  ctx.fillRect(m.left, m.binTop, m.right - m.left, m.floorY - m.binTop);

  for (let i = 0; i < m.bins; i += 1) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = "rgba(36, 30, 26, 0.035)";
    ctx.fillRect(m.left + i * m.spacing, m.binTop, m.spacing, m.floorY - m.binTop);
  }

  ctx.strokeStyle = "rgba(157, 52, 24, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(m.centerX, m.spawnY - 8);
  ctx.lineTo(m.centerX, m.binTop);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#9d3418";
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.moveTo(m.centerX - 11, 16);
  ctx.lineTo(m.centerX, 28);
  ctx.lineTo(m.centerX + 11, 16);
  ctx.stroke();
  ctx.fillStyle = "#9d3418";
  ctx.font = "700 11px \"Avenir Next\", \"Segoe UI\", sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("FAIR CENTER", m.centerX + 14, 22);

  ctx.fillStyle = "#3a342c";
  ctx.fillRect(m.left, m.binTop, m.right - m.left, 2);
  for (let i = 1; i < m.bins; i += 1) {
    const x = m.left + i * m.spacing;
    ctx.fillRect(x - 1.5, m.binTop, 3, m.floorY - m.binTop);
  }
  ctx.fillRect(m.left - 2, m.spawnY - 10, 3, m.floorY - m.spawnY + 10);
  ctx.fillRect(m.right - 1, m.spawnY - 10, 3, m.floorY - m.spawnY + 10);
  ctx.fillRect(m.left, m.floorY - 2, m.right - m.left, 3);

  for (let i = 0; i < state.pegs.length; i += 1) {
    const peg = state.pegs[i];
    ctx.beginPath();
    ctx.fillStyle = "rgba(40, 30, 20, 0.14)";
    ctx.arc(peg.position.x + 0.8, peg.position.y + 1.4, m.pegR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#2b2723";
    ctx.arc(peg.position.x, peg.position.y, m.pegR, 0, Math.PI * 2);
    ctx.fill();
  }

  const counts = Array(m.bins).fill(0);
  const tops = Array(m.bins).fill(null);
  for (let i = 0; i < state.balls.length; i += 1) {
    const ball = state.balls[i];
    drawBall(ctx, ball.position.x, ball.position.y, m.ballR, ball.galtonColor);
    if (!ball.galtonSettled) continue;
    counts[ball.galtonBin] += 1;
    if (tops[ball.galtonBin] === null || ball.position.y < tops[ball.galtonBin]) {
      tops[ball.galtonBin] = ball.position.y;
    }
  }
  ctx.font = "700 12px \"Avenir Next\", \"Segoe UI\", sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1c4f45";
  for (let k = 0; k < m.bins; k += 1) {
    if (!counts[k]) continue;
    const labelY = Math.max(m.binTop + 14, tops[k] - m.ballR - 11);
    ctx.fillText(String(counts[k]), m.left + (k + 0.5) * m.spacing, labelY);
  }

  ctx.fillStyle = "#5c564c";
  ctx.font = "600 13px \"Avenir Next\", \"Segoe UI\", sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < m.bins; i += 1) {
    ctx.fillText(String(i), m.left + (i + 0.5) * m.spacing, m.floorY + 13);
  }

  ctx.restore();
}

function drawBall(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 248, 240, 0.45)";
  ctx.arc(x - r * 0.28, y - r * 0.32, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function setNotice(text) {
  state.notice = text;
  els.notice.textContent = text;
}

function formatPct(value) {
  const percent = value * 100;
  if (percent > 0 && percent < 0.5) return "<1%";
  return Math.round(percent) + "%";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

