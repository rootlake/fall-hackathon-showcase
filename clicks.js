/* Click-through for class. Scored three-ways first, then the open
   face-offs, then the two solos. That keeps the early leaderboard a
   one-point race and holds the two solo 4s until the last cards. */
const ShowClicks = (function () {
  const STEPS = [
    { kind: "gallery" },
    { kind: "preview", dept: "art" },
    { kind: "points", dept: "art" },
    { kind: "board", depts: ["art"] },
    { kind: "preview", dept: "languages" },
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

  function panels(deptId, withPoints, withNotes, mixed) {
    const now = S.standing();
    const result = now.perDept[deptId];
    const teams = now.entered[deptId];
    const places = result.places || [];
    const ready = result.state === "ranked" || result.state === "solo";
    let order = teams.slice();
    if (mixed) shuffle(order);
    else if (ready && places.length === teams.length) order = places.map((row) => row.team);
    const html = order.map((teamId) => {
      const sub = S.covering(teamId, deptId);
      const place = places.find((row) => row.team === teamId);
      const pts = withPoints && place ? place.points : null;
      return projectPanel(sub, teamId, pts, withNotes);
    }).join("");
    const wrap = order.length === 1 ? "solo-show" : "faceoff n" + Math.min(order.length, 4);
    return { ready: ready, html: '<div class="' + wrap + '">' + html + "</div>" };
  }

  let boardTimer = 0;

  function rowsFor(depts) {
    const now = S.standing();
    const totals = {};
    S.L.TEAMS.forEach((team) => { totals[team.id] = 0; });
    let waiting = false;
    depts.forEach((id) => {
      const result = now.perDept[id];
      if (!result) return;
      if (result.state === "needs-judges" || result.state === "tie") waiting = true;
      (result.places || []).forEach((place) => { totals[place.team] += place.points; });
    });
    const rows = S.L.TEAMS.map((team) => ({ team: team, points: totals[team.id] }));
    rows.sort((a, b) => b.points - a.points || a.team.name.localeCompare(b.team.name));
    return { rows: rows, waiting: waiting };
  }

  function rowHtml(row) {
    return '<li data-team="' + row.team.id + '"><span class="who"><i class="mark">' + row.team.mark + "</i> " +
      S.esc(row.team.name) + '<small class="roster">' + S.memberLine(row.team) + '</small></span><b class="pts">' +
      row.points + "</b></li>";
  }

  function stopBoard() {
    clearTimeout(boardTimer);
    boardTimer = 0;
  }

  function paintBoard(depts, stepNo) {
    stopBoard();
    const prev = rowsFor(depts.slice(0, -1));
    const next = rowsFor(depts);
    S.app.innerHTML = '<section class="stage-slide show-step"><h1>So far</h1>' +
      (next.waiting ? '<p class="lead">One face-off on this board is still open.</p>' : "") +
      '<ol class="show-board">' + prev.rows.map(rowHtml).join("") + "</ol>" +
      '<p class="keys">' + stepNo + " / " + STEPS.length + " · click or arrows</p></section>";
    const unchanged = prev.rows.every((row, i) => row.team.id === next.rows[i].team.id && row.points === next.rows[i].points);
    if (unchanged) return;
    boardTimer = setTimeout(() => {
      const list = S.app.querySelector(".show-board");
      if (!list) return;
      const first = {};
      list.querySelectorAll("[data-team]").forEach((el) => { first[el.dataset.team] = el.getBoundingClientRect(); });
      next.rows.forEach((row) => {
        const el = list.querySelector('[data-team="' + row.team.id + '"]');
        const pts = el.querySelector(".pts");
        if (Number(pts.textContent) !== row.points) {
          pts.textContent = String(row.points);
          pts.classList.remove("bump");
          void pts.offsetWidth;
          pts.classList.add("bump");
        }
        list.appendChild(el);
      });
      list.querySelectorAll("[data-team]").forEach((el) => {
        const dy = first[el.dataset.team].top - el.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) return;
        el.style.zIndex = "2";
        el.style.transition = "none";
        el.style.transform = "translateY(" + dy + "px)";
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          list.querySelectorAll("[data-team]").forEach((el) => {
            if (!el.style.transform) return;
            el.style.transition = "transform 0.85s cubic-bezier(0.2, 0.8, 0.2, 1)";
            el.style.transform = "none";
          });
        });
      });
    }, 1200);
  }

  function gallery() {
    const subs = shuffle((S.state.submissions || []).filter((sub) => !sub.dq).slice());
    const cards = subs.map((sub) => {
      const team = S.L.teamById(sub.team);
      return '<figure class="gallery-card">' + S.thumb(sub) +
        '<figcaption><i class="mark">' + team.mark + "</i> " + S.esc(team.name) + "</figcaption></figure>";
    }).join("");
    return '<h1>Hackathon Results</h1><div class="gallery">' + cards + "</div>";
  }

  function slide(step) {
    if (step.kind === "gallery") return gallery();
    const dept = S.L.deptById(step.dept);
    if (step.kind === "board") return "";
    if (step.kind === "faceoff" || step.kind === "preview") {
      const suffix = step.kind === "faceoff" ? " face-off" : "";
      return "<h1>" + S.esc(dept.name) + suffix + "</h1>" + panels(step.dept, false, false, true).html;
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
      if (group.from === 1 && ids.length > 1) {
        shuffle(ids);
        out.push({ kind: "pair", teams: ids, points: group.points });
        out.push({ kind: "tie", confetti: true, teams: ids.slice(), points: group.points });
        out.push({ kind: "tiebreaker" });
        out.push({ kind: "english" });
        return;
      }
      ids.forEach((id) => {
        out.push({ team: id, points: group.points, word: WORD[group.from] || "Tied" });
      });
    });
    return out;
  }

  function teamLine(team) {
    return '<p class="team-line"><i class="mark">' + team.mark + "</i> " + S.esc(team.name) +
      '<small class="roster">' + S.memberLine(team) + "</small></p>";
  }

  function stopFinale() {
    live = false;
    clearTimeout(timer);
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
    if (item.kind === "pair") {
      body = '<p class="place-word">First</p><div class="finale-pair">' +
        item.teams.map((id) => "<div>" + teamLine(S.L.teamById(id)) +
          '<p class="points-line finale-points">' + item.points + " points</p></div>").join("") +
        "</div>";
    } else if (item.kind === "tie") {
      body = '<p class="place-word">Tie</p>' +
        item.teams.map((id) => teamLine(S.L.teamById(id))).join("") +
        '<p class="points-line finale-points">' + item.points + " points</p>";
    } else if (item.kind === "tiebreaker") {
      body = '<p class="place-word long">Tiebreaker?!</p>';
    } else if (item.kind === "english") {
      body = '<p class="place-word">English</p><p class="team-line">One last simulation</p>' +
        '<p class="points-line finale-points">30 minutes</p>' +
        '<p class="lead finale-note">An English class. It was not represented in this hackathon. Anyone can participate. The score counts for the individual tiebreaker and for team placement.</p>';
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
    clearTimeout(timer);
    timer = 0;
    const item = script[beat];
    if (!item || beat >= script.length - 1) return;
    if (item.kind === "tiebreaker" || item.kind === "english") return;
    const wait = item.kind === "pair" || item.kind === "tie" ? 3200 : 1700;
    timer = setTimeout(() => {
      beat += 1;
      paintFinale();
      arm();
    }, wait);
  }

  function render(index) {
    const at = Math.min(Math.max(0, index), STEPS.length - 1);
    stopBoard();
    if (STEPS[at].kind === "board") {
      if (live) stopFinale();
      paintBoard(STEPS[at].depts, at + 1);
      return;
    }
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
