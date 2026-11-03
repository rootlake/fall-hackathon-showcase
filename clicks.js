/* Click-through for class. Scored three-ways first, then the open
   face-offs, then the two solos. That keeps the early leaderboard a
   one-point race and holds the two solo 4s until the last cards. */
const ShowClicks = (function () {
  const STEPS = [
    { kind: "points", dept: "art" },
    { kind: "board", depts: ["art"] },
    { kind: "points", dept: "languages" },
    { kind: "board", depts: ["art", "languages"] },
    { kind: "faceoff", dept: "math" },
    { kind: "results", dept: "math" },
    { kind: "board", depts: ["art", "languages", "math"] },
    { kind: "faceoff", dept: "science" },
    { kind: "results", dept: "science" },
    { kind: "board", depts: ["art", "languages", "math", "science"] },
    { kind: "points", dept: "history" },
    { kind: "board", depts: ["art", "languages", "math", "science", "history"] },
    { kind: "points", dept: "wellbeing" },
    { kind: "finale" },
  ];

  function panels(deptId, withPoints, withNotes) {
    const now = S.standing();
    const result = now.perDept[deptId];
    const teams = now.entered[deptId];
    const places = result.places || [];
    const ready = result.state === "ranked" || result.state === "solo";
    const order = ready && places.length === teams.length ? places.map((row) => row.team) : teams;
    const html = order.map((teamId) => {
      const sub = S.covering(teamId, deptId);
      const place = places.find((row) => row.team === teamId);
      const pts = withPoints && place ? place.points : null;
      return projectPanel(sub, teamId, pts, withNotes);
    }).join("");
    const wrap = order.length === 1 ? "solo-show" : "faceoff n" + Math.min(order.length, 4);
    return { ready: ready, html: '<div class="' + wrap + '">' + html + "</div>" };
  }

  function board(depts) {
    const now = S.standing();
    const totals = {};
    S.L.TEAMS.forEach((team) => { totals[team.id] = 0; });
    let waiting = false;
    depts.forEach((id) => {
      const result = now.perDept[id];
      if (result.state === "needs-judges" || result.state === "tie") waiting = true;
      (result.places || []).forEach((place) => { totals[place.team] += place.points; });
    });
    const rows = S.L.TEAMS.map((team) => ({ team: team, points: totals[team.id] }));
    rows.sort((a, b) => b.points - a.points || a.team.name.localeCompare(b.team.name));
    const list = rows.map((row) => '<li><span class="who"><i class="mark">' + row.team.mark + "</i> " +
      S.esc(row.team.name) + '<small class="roster">' + S.memberLine(row.team) + "</small></span><b class=\"pts\">" + row.points + "</b></li>").join("");
    return "<h1>So far</h1>" +
      (waiting ? '<p class="lead">One face-off on this board is still open.</p>' : "") +
      '<ol class="show-board">' + list + "</ol>";
  }

  function slide(step) {
    const dept = S.L.deptById(step.dept);
    if (step.kind === "board") return board(step.depts);
    if (step.kind === "faceoff") {
      return "<h1>" + S.esc(dept.name) + " face-off</h1>" + panels(step.dept, false, false).html;
    }
    const scored = panels(step.dept, true, true);
    const title = "<h1>" + S.esc(dept.name) + "</h1>";
    if (!scored.ready) return title + '<p class="lead">Points are not in yet.</p>' + panels(step.dept, false, false).html;
    return title + scored.html;
  }

  const WORD = { 1: "First", 2: "Second", 3: "Third", 4: "Fourth" };
  const SCORED = ["art", "languages", "math", "science", "history", "wellbeing"];
  let script = [];
  let beat = 0;
  let timer = 0;
  let raf = 0;
  let live = false;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const held = list[i];
      list[i] = list[j];
      list[j] = held;
    }
    return list;
  }

  function totals() {
    const now = S.standing();
    const sum = {};
    S.L.TEAMS.forEach((team) => { sum[team.id] = 0; });
    SCORED.forEach((id) => {
      ((now.perDept[id] && now.perDept[id].places) || []).forEach((place) => { sum[place.team] += place.points; });
    });
    return sum;
  }

  function buildScript() {
    const groups = S.L.placeGroups(totals(), []).slice().reverse();
    const out = [];
    groups.forEach((group) => {
      const ids = group.teams.slice();
      if (ids.length > 1) shuffle(ids);
      const tied = group.from !== group.to;
      ids.forEach((id) => {
        out.push({ team: id, points: group.points, word: tied && group.from === 1 ? "First" : (WORD[group.from] || "Tied"), tied: tied });
      });
    });
    const winners = groups.filter((group) => group.from === 1).pop();
    if (winners) out.push({ confetti: true, teams: winners.teams.slice(), points: winners.points, tied: winners.teams.length > 1 });
    return out;
  }

  function teamLine(team) {
    return '<p class="team-line"><i class="mark">' + team.mark + "</i> " + S.esc(team.name) +
      '<small class="roster">' + S.memberLine(team) + "</small></p>";
  }

  function stopFinale() {
    live = false;
    clearInterval(timer);
    timer = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    const canvas = document.querySelector("canvas.confetti");
    if (canvas) canvas.remove();
  }

  function mountConfetti() {
    if (raf) cancelAnimationFrame(raf);
    let canvas = document.querySelector("canvas.confetti");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "confetti";
      document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const colors = ["#7a4e08", "#e2b657", "#f4efe4", "#1a2c34", "#a33b32", "#d7c4a3"];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * w,
      y: Math.random() * -h,
      vx: -1.6 + Math.random() * 3.2,
      vy: 2.2 + Math.random() * 3.4,
      rot: Math.random() * 6,
      vr: -0.18 + Math.random() * 0.36,
      pw: 7 + Math.random() * 8,
      ph: 10 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    function frame() {
      ctx.clearRect(0, 0, w, h);
      pieces.forEach((piece) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.035;
        piece.rot += piece.vr;
        if (piece.y > h + 24) {
          piece.y = -20;
          piece.x = Math.random() * w;
          piece.vy = 2.2 + Math.random() * 3;
        }
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.pw / 2, -piece.ph / 2, piece.pw, piece.ph);
        ctx.restore();
      });
      raf = requestAnimationFrame(frame);
    }
    frame();
  }

  function paintFinale() {
    const item = script[beat];
    if (!item) return;
    let body;
    if (item.confetti) {
      body = '<p class="place-word">' + (item.tied ? "Tie" : "First") + "</p>" +
        item.teams.map((id) => teamLine(S.L.teamById(id))).join("") +
        '<p class="points-line finale-points">' + item.points + " points</p>";
    } else {
      body = '<p class="place-word">' + item.word + "</p>" + teamLine(S.L.teamById(item.team)) +
        '<p class="points-line finale-points">' + item.points + " points</p>";
    }
    S.app.innerHTML = '<section class="stage-slide finale-pop">' + body +
      '<p class="keys">places</p></section>';
    if (item.confetti) mountConfetti();
    else {
      const canvas = document.querySelector("canvas.confetti");
      if (canvas) canvas.remove();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function arm() {
    clearInterval(timer);
    if (beat >= script.length - 1) { timer = 0; return; }
    timer = setInterval(() => {
      if (beat >= script.length - 1) { clearInterval(timer); timer = 0; return; }
      beat += 1;
      paintFinale();
    }, 1700);
  }

  function render(index) {
    const at = Math.min(Math.max(0, index), STEPS.length - 1);
    if (STEPS[at].kind !== "finale") {
      if (live) stopFinale();
      const body = slide(STEPS[at]);
      S.app.innerHTML = '<section class="stage-slide show-step">' + body +
        '<p class="keys">' + (at + 1) + " / " + STEPS.length + " · click or arrows</p></section>";
      return;
    }
    if (!live) {
      script = buildScript();
      beat = 0;
      live = true;
      arm();
    }
    paintFinale();
  }

  function bump(dir) {
    if (!live) return false;
    if (dir > 0 && beat >= script.length - 1) return true;
    const next = beat + dir;
    if (next < 0 || next >= script.length) return false;
    beat = next;
    paintFinale();
    arm();
    return true;
  }

  return { count: STEPS.length, render: render, bump: bump };
})();
