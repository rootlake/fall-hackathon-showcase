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
    { kind: "board", depts: ["art", "languages", "math", "science", "history", "wellbeing"] },
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
    const last = depts.length === STEPS[STEPS.length - 1].depts.length && !waiting;
    const list = rows.map((row) => '<li><span class="who"><i class="mark">' + row.team.mark + "</i> " +
      S.esc(row.team.name) + '</span><b class="pts">' + row.points + "</b></li>").join("");
    return '<h1>' + (last ? "Leaderboard" : "So far") + "</h1>" +
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

  function render(index) {
    const at = Math.min(Math.max(0, index), STEPS.length - 1);
    const body = slide(STEPS[at]);
    S.app.innerHTML = '<section class="stage-slide show-step">' + body +
      '<p class="keys">' + (at + 1) + " / " + STEPS.length + " · click or arrows</p></section>";
  }

  return { count: STEPS.length, render: render };
})();
