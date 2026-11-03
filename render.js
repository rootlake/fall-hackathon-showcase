/* Views for the show. Reads the shared `S` object set by show.js. */

function projectPanel(sub, teamId, points) {
  const team = S.L.teamById(teamId);
  const src = sub ? S.openUrl(sub) : "";
  const award = points == null ? "" : '<b class="award">' + points + "</b>";
  const quote = S.notesOn && sub && sub.note ? '<blockquote class="faculty">' + S.esc(sub.note) + "</blockquote>" : "";
  return '<article class="panel show' + (quote ? " noted" : "") + '"><div class="demo">' + award +
    '<h2><i class="mark">' + team.mark + "</i> " + S.esc(team.name) + "</h2>" +
    (sub ? S.thumb(sub) : "") +
    '<p class="proj">' + S.esc(sub ? (sub.label || S.subName(sub)) : "") + "</p>" +
    (src ? '<a class="live" href="' + S.esc(src) + '" target="_blank" rel="noopener">' + S.esc(src) + "</a>" : "<p>No public link.</p>") +
    "</div>" + quote + "</article>";
}

const ShowRender = {
  tree(view, id) {
    const here = (href) => (location.hash === href ? " here" : "");
    let html = '<a class="root' + here("#/all") + '" href="#/all">Fall Hackathon Showcase</a>';
    html += '<a class="' + here("#/all") + '" href="#/all">start</a>';
    html += '<a class="' + here("#/board") + '" href="#/board">board</a>';
    html += '<div class="branch">teams</div>';
    S.L.TEAMS.forEach((team) => {
      const href = "#/teams/" + team.id;
      html += '<a class="d2' + here(href) + '" href="' + href + '">' + S.esc(team.name) + "</a>";
      if (view === "teams" && id === team.id) {
        S.teamSubs(team.id).forEach((sub) => {
          const leaf = href + "/" + sub.id;
          html += '<a class="d3' + here(leaf) + '" href="' + leaf + '">' + S.esc(S.subName(sub)) + "</a>";
        });
      }
    });
    html += '<div class="branch">departments</div>';
    const now = S.standing();
    S.L.DEPTS.forEach((dept) => {
      const st = now.perDept[dept.id].state;
      if (st === "empty") return;
      const href = "#/departments/" + dept.id;
      const flag = st === "needs-judges" || st === "tie" ? ' <span class="flag">face-off</span>' : "";
      html += '<a class="d2' + here(href) + '" href="' + href + '">' + S.esc(dept.name) + flag + "</a>";
    });
    html += '<a class="' + here("#/reveal") + '" href="#/reveal">reveal</a>';
    html += '<a class="' + here("#/spotlight") + '" href="#/spotlight">spotlight</a>';
    html += '<a class="' + here("#/sheet") + '" href="#/sheet">form</a>';
    S.treeEl.innerHTML = html;
  },

  crumb(parts) {
    const bits = [{ href: "#/all", label: "Showcase" }];
    const view = parts[0];
    if (!view || view === "all") bits.push({ href: "#/all", label: "Start" });
    else if (view === "board") bits.push({ href: "#/board", label: "Board" });
    else if (view === "sheet") bits.push({ href: "#/sheet", label: "Form" });
    else if (view === "reveal") bits.push({ href: "#/reveal", label: "Reveal" });
    else if (view === "spotlight" || view === "present") bits.push({ href: "#/spotlight", label: "Spotlight" });
    else if (view === "teams") {
      bits.push({ href: "#/all", label: "Teams" });
      const team = S.L.teamById(parts[1]);
      if (team) bits.push({ href: "#/teams/" + team.id, label: team.name });
      const sub = parts[2] && S.submission(parts[2]);
      if (sub) bits.push({ href: location.hash, label: S.subName(sub) });
    } else if (view === "departments" || view === "judge") {
      bits.push({ href: "#/departments", label: "Departments" });
      const dept = S.L.deptById(parts[1]);
      if (dept) bits.push({ href: "#/departments/" + dept.id, label: dept.name });
    }
    S.crumbEl.innerHTML = bits.map((bit, i) => {
      const node = i === bits.length - 1 ? S.esc(bit.label) : '<a href="' + bit.href + '">' + S.esc(bit.label) + "</a>";
      return (i ? '<span class="sep">/</span>' : "") + node;
    }).join("");
  },

  all() {
    if (!S.state.submissions.length) {
      S.app.innerHTML = '<h1>Fall Hackathon Showcase</h1><p class="lead">The form is still empty. At 3:00, copy the response sheet — header row included — and paste it on the <a href="#/sheet">form</a> page.</p>';
      return;
    }
    const stage = S.openStage || "pack";
    const filed = stage !== "pack";
    const now = S.standing();
    const solos = {};
    S.L.TEAMS.forEach((team) => { solos[team.id] = 0; });
    S.L.DEPTS.forEach((dept) => {
      const result = now.perDept[dept.id];
      if (result.state === "solo") solos[result.places[0].team] += 4;
    });
    let bar = '<div class="open-bar"><h1>Fall Hackathon Showcase</h1>';
    if (stage === "pack") bar += '<button type="button" data-act="file-depts">Departments</button>';
    else if (stage === "filed") bar += '<button type="button" data-act="score-solos">Add the solo 4s</button>';
    else bar += '<button type="button" class="quiet" data-act="replay-open">Replay</button>';
    bar += "</div>";
    let html = bar + '<div class="opener ' + (filed ? "filed" : "pack") + '" id="opener"><div></div>';
    if (!filed) html += '<div class="dept-slot"></div>';
    else {
      S.L.DEPTS.forEach((dept) => {
        const result = now.perDept[dept.id];
        const head = dept.id === "languages" ? "Languages" : dept.name;
        let note = "";
        if (result.state === "empty") note = "—";
        else if (result.state === "solo") note = stage === "scored" ? "4 points" : "solo";
        else note = "face-off";
        html += '<a class="dept-head in" href="#/departments/' + dept.id + '">' + S.esc(head) + "<small>" + note + "</small></a>";
      });
    }
    html += '<div class="pts-head">pts</div>';
    S.L.TEAMS.forEach((team) => {
      html += '<a class="team-head" href="#/teams/' + team.id + '"><i class="mark">' + team.mark + "</i> " + S.esc(team.name) +
        "<small>" + S.esc(team.members.join(", ")) + "</small></a>";
      const subs = S.teamSubs(team.id);
      if (!filed) {
        subs.slice(0, 4).forEach((sub) => { html += openTile(sub, team, "", sub.id); });
        for (let i = subs.length; i < 4; i++) html += '<div class="cell vacant"></div>';
      } else {
        S.L.DEPTS.forEach((dept) => {
          const sub = S.covering(team.id, dept.id);
          const result = now.perDept[dept.id];
          if (!sub) { html += '<div class="cell gap in"></div>'; return; }
          const solo = result.state === "solo";
          const key = (sub.departments || [])[0] === dept.id ? sub.id : sub.id + "-" + dept.id;
          const badge = stage === "scored" && solo ? "<b>4</b>" : "";
          html += openTile(sub, team, solo ? " solo" + (stage === "scored" ? " celebrate" : "") : " crowded", key, badge);
        });
      }
      const pts = stage === "scored" ? solos[team.id] : 0;
      html += '<div class="total' + (stage === "scored" && pts ? " bump" : "") + '">' + pts + "</div>";
    });
    html += "</div>";
    if (stage === "scored") {
      const faces = S.L.DEPTS.filter((dept) => {
        const st = now.perDept[dept.id].state;
        return st === "needs-judges" || st === "tie" || st === "ranked";
      });
      html += '<p class="lead face-next">Face-offs: ' +
        faces.map((dept) => '<a href="#/departments/' + dept.id + '">' + S.esc(dept.name) + "</a>").join(" · ") + "</p>";
    }
    S.app.innerHTML = html;
    if (!filed) ShowRender.fitPack();
  },

  fitPack() {
    const grid = document.getElementById("opener");
    if (!grid || !grid.classList.contains("pack")) return;
    const style = getComputedStyle(grid);
    const gap = parseFloat(style.rowGap) || 0;
    const header = 42;
    const byHeight = Math.floor((grid.clientHeight - header - gap * 4) / 4);
    const maxW = grid.parentElement.clientWidth;
    const byWidth = Math.floor((maxW - 184 - 58 - gap * 5) / 4);
    const size = Math.max(48, Math.min(byHeight, byWidth));
    grid.style.width = (184 + 58 + size * 4 + gap * 5) + "px";
    grid.style.gridTemplateColumns = "184px repeat(4, " + size + "px) 58px";
    grid.style.gridTemplateRows = header + "px repeat(4, " + size + "px)";
  },

  team(teamId) {
    const team = S.L.teamById(teamId);
    if (!team) { S.app.innerHTML = "<h1>Unknown team</h1>"; return; }
    const subs = S.teamSubs(team.id);
    const hint = (subs.find((sub) => sub.hint && sub.hint.length) || {}).hint;
    const filed = new Set(subs.flatMap((sub) => sub.departments || []));
    S.app.innerHTML = '<h1><i class="mark">' + team.mark + "</i> " + S.esc(team.name) + "</h1>" +
      '<p class="members">' + S.esc(team.members.join(", ")) + "</p>" +
      (filed.size > 4 ? '<p class="warn">Filed in ' + filed.size + " departments. The challenge allows four.</p>" : "") +
      (hint ? '<p class="quiet-note">The form listed ' + S.esc(hint.map((id) => S.L.deptById(id).name).join(", ")) + ".</p>" : "") +
      (subs.length ? '<div class="quad fill">' + subs.map(S.card).join("") + "</div>" : "<p>Nothing from this team yet.</p>");
  },

  entry(id) {
    const sub = S.submission(id);
    if (!sub) { S.app.innerHTML = "<h1>Missing simulation</h1>"; return; }
    const team = S.L.teamById(sub.team);
    const src = S.openUrl(sub);
    const repoHref = S.safeUrl(sub.repo);
    const repo = S.L.repoClone(sub.repo) || S.L.repoClone(sub.url);
    const checks = S.L.DEPTS.map((dept) => {
      const taken = S.state.submissions.some((other) => other.id !== sub.id && other.team === sub.team && (other.departments || []).includes(dept.id));
      const on = (sub.departments || []).includes(dept.id);
      return '<label><input type="checkbox" data-act="dept" data-id="' + sub.id + '" data-dept="' + dept.id + '"' +
        (on ? " checked" : "") + (taken ? " disabled" : "") + "> " + S.esc(dept.name) + "</label>";
    }).join("");
    S.app.innerHTML = "<h1>" + S.esc(S.subName(sub)) + "</h1>" +
      '<p class="lead"><a href="#/teams/' + team.id + '">' + S.esc(team.name) + "</a></p>" +
      (src ? '<iframe class="sim" src="' + S.esc(src) + '" title="' + S.esc(team.name) + '"></iframe>' : "<p>No web link on this row.</p>") +
      '<div class="panel"><div class="row">' +
      (src ? '<a class="btn" href="' + S.esc(src) + '" target="_blank" rel="noopener">Open the live page</a>' : "") +
      (repoHref ? '<a class="btn" href="' + S.esc(repoHref) + '" target="_blank" rel="noopener">Repo</a>' : "") +
      (repo ? '<span class="quiet-note">Clone folder entries/' + S.esc(sub.team) + "/" + S.esc(repo.name) + "</span>" : "") +
      '</div><p><label>Class name <input data-act="field" data-id="' + sub.id + '" data-field="label" value="' + S.esc(sub.label) + '"></label></p>' +
      '<p><label>Live link <input data-act="field" data-id="' + sub.id + '" data-field="url" value="' + S.esc(sub.url) + '" size="48"></label></p>' +
      '<p><label>Repo <input data-act="field" data-id="' + sub.id + '" data-field="repo" value="' + S.esc(sub.repo) + '" size="48"></label></p>' +
      '<div class="checks">' + checks + "</div></div>";
  },

  board() {
    const now = S.standing();
    let html = '<h1>Board</h1>' + practiceNote() + '<p class="lead">A team alone in a department takes <b>4</b>. A face-off pays <b>4</b>, then <b>3</b>, then <b>2</b>, then <b>1</b>.</p><div class="board"><div></div>';
    S.L.DEPTS.forEach((dept) => {
      const result = now.perDept[dept.id];
      const note = result.state === "solo" ? "4 points" : result.state === "empty" ? "—" : result.state === "ranked" ? "ranked" : "face-off";
      const head = dept.id === "languages" ? "Languages" : dept.name;
      html += '<a class="dept-head" href="#/departments/' + dept.id + '">' + S.esc(head) + "<small>" + note + "</small></a>";
    });
    html += '<div class="pts-head">pts</div>';
    S.L.TEAMS.forEach((team) => {
      html += '<a class="team-head" href="#/teams/' + team.id + '"><i class="mark">' + team.mark + "</i> " + S.esc(team.name) + "</a>";
      S.L.DEPTS.forEach((dept) => {
        const result = now.perDept[dept.id];
        const sub = S.covering(team.id, dept.id);
        if (!sub) {
          html += '<a class="cell gap" href="#/departments/' + dept.id + '" aria-label="gap"></a>';
          return;
        }
        const place = (result.places || []).find((row) => row.team === team.id);
        const badge = place ? "<b>" + place.points + "</b>" : "<b>?</b>";
        html += '<a class="cell ' + result.state + '" href="#/teams/' + team.id + "/" + sub.id + '">' + S.thumb(sub) + badge + "</a>";
      });
      html += '<div class="total">' + now.totals[team.id] + "</div>";
    });
    html += "</div>";
    if (now.pending) html += '<p class="warn">Face-off points are not in yet.</p>';
    const loose = S.state.submissions.filter((sub) => !(sub.departments || []).length);
    if (loose.length) {
      html += '<div class="loose"><p>Not filed yet. Open a simulation and tick its department.</p><div class="cards">' + loose.map(S.card).join("") + "</div></div>";
    }
    if (!S.state.submissions.length) html += '<p><a href="#/sheet">Paste the form</a></p>';
    S.app.innerHTML = html;
  },

  deptIndex() {
    const now = S.standing();
    S.app.innerHTML = "<h1>Departments</h1>" + practiceNote() + '<div class="cards">' + S.L.DEPTS.filter((dept) => now.perDept[dept.id].state !== "empty").map((dept) => {
      const result = now.perDept[dept.id];
      const who = now.entered[dept.id].map((id) => S.L.teamById(id).name).join(", ") || "nobody";
      const label = result.state === "needs-judges" ? "face-off" : result.state;
      return '<a class="card" href="#/departments/' + dept.id + '"><div class="meta"><strong>' + S.esc(dept.name) +
        "</strong><br><small>" + S.esc(who) + " · " + S.esc(label) + "</small></div></a>";
    }).join("") + "</div>";
  },

  dept(deptId, judging) {
    const dept = S.L.deptById(deptId);
    if (!dept) { S.app.innerHTML = "<h1>Unknown department</h1>"; return; }
    const now = S.standing();
    const result = now.perDept[dept.id];
    const teams = now.entered[dept.id];
    let body = "";
    if (!teams.length) body = "<p>Nobody entered " + S.esc(dept.name) + ".</p>";
    else if (result.state === "solo") {
      const sub = S.covering(teams[0], dept.id);
      body = '<p class="lead">' + S.esc(S.L.teamById(teams[0]).name) + ' is alone here. That is <b>4</b> points.</p>' +
        '<div class="solo-show">' + projectPanel(sub, teams[0], 4) + "</div>";
    } else {
      const across = teams.length >= 4 ? "n4" : "n" + teams.length;
      body = '<div class="faceoff ' + across + '">' + teams.map((teamId) => {
        const sub = S.covering(teamId, dept.id);
        const place = (result.places || []).find((row) => row.team === teamId);
        return projectPanel(sub, teamId, place ? place.points : null);
      }).join("") + "</div>";
    }
    const noted = teams.some((teamId) => {
      const sub = S.covering(teamId, dept.id);
      return sub && sub.note;
    });
    const toggle = noted
      ? '<button type="button" class="quiet" data-act="toggle-notes">' + (S.notesOn ? "Hide comments" : "Show comments") + "</button>"
      : "";
    S.app.innerHTML = '<div class="dept-bar"><h1>' + S.esc(dept.name) + "</h1>" + toggle + "</div>" + body;
  },

  reveal() {
    const now = S.standing();
    if (!S.state.submissions.length) {
      S.app.innerHTML = '<section class="stage-slide"><h1>Nothing to reveal yet</h1></section>';
      return;
    }
    if (now.pending) {
      const open = S.L.DEPTS.filter((dept) => {
        const st = now.perDept[dept.id].state;
        return st === "needs-judges" || st === "tie";
      });
      S.app.innerHTML = '<section class="stage-slide"><h1>Not ready</h1><ul class="chips">' +
        open.map((dept) => '<li><a href="#/departments/' + dept.id + '">' + S.esc(dept.name) + "</a></li>").join("") +
        "</ul></section>";
      return;
    }
    const steps = S.L.revealScript(now.totals, S.state.overallOrder);
    const step = steps[Math.min(S.revealAt, Math.max(0, steps.length - 1))];
    if (!step) { S.app.innerHTML = '<section class="stage-slide"><h1>No places</h1></section>'; return; }
    if (step.kind === "tie") {
      const ordered = (S.state.overallOrder || []).filter((id) => step.teams.includes(id));
      const remain = step.teams.filter((id) => !ordered.includes(id));
      S.app.innerHTML = '<section class="stage-slide"><p class="place-word">Tie</p><p class="points-line">' + step.points +
        " points, before " + S.WORDS[step.before].toLowerCase() + '.</p><div class="tie-actions">' +
        ordered.map((id, i) => "<p>" + (i + 1) + ". " + S.esc(S.L.teamById(id).name) + "</p>").join("") +
        remain.map((id) => '<button type="button" data-act="break-overall" data-team="' + id + '">' +
          S.esc(S.L.teamById(id).name) + (ordered.length ? " places next" : " takes the higher place") + "</button>").join("") +
        (ordered.length ? '<button type="button" class="quiet" data-act="clear-overall">Clear this tie</button>' : "") +
        "</div></section>";
      return;
    }
    const team = S.L.teamById(step.team);
    const called = steps.slice(0, S.revealAt).filter((item) => item.kind === "place");
    const chips = S.L.DEPTS.map((dept) => {
      const place = (now.perDept[dept.id].places || []).find((row) => row.team === team.id);
      return place ? "<li>" + S.esc(dept.name) + " " + place.points + "</li>" : "";
    }).join("");
    S.app.innerHTML = '<section class="stage-slide"><p class="place-word">' + S.WORDS[step.place] + '</p><p class="team-line"><i class="mark">' +
      team.mark + "</i> " + S.esc(team.name) + '</p><p class="points-line">' + step.points + ' points</p><ul class="chips">' + chips +
      "</ul>" + (called.length ? '<p class="called">' + called.map((item) => S.WORDS[item.place] + " <b>" + S.esc(S.L.teamById(item.team).name) + "</b>").join(" · ") + "</p>" : "") +
      '<p class="keys">Arrow keys</p></section>';
  },

  spotlight() {
    const picks = S.state.spotlights || {};
    const used = {};
    S.L.TEAMS.forEach((team) => {
      const dept = picks[team.id] && picks[team.id].department;
      if (dept) used[dept] = (used[dept] || 0) + 1;
    });
    const clash = Object.keys(used).filter((id) => used[id] > 1).map((id) => S.L.deptById(id).name);
    S.app.innerHTML = '<h1>Spotlight</h1><p class="lead">One simulation from each team, in four different departments if we can.</p>' +
      (clash.length ? '<p class="warn">Shared department: ' + S.esc(clash.join(", ")) + ".</p>" : "") +
      '<p class="row"><button type="button" data-act="suggest">Suggest a spread</button><a class="btn" href="#/present">Present</a></p>' +
      S.L.TEAMS.map((team) => {
        const pick = picks[team.id] || {};
        const options = ['<option value="">Choose</option>'].concat(S.teamSubs(team.id).flatMap((sub) => {
          const depts = sub.departments && sub.departments.length ? sub.departments : [""];
          return depts.map((dept) => {
            const value = sub.id + "|" + dept;
            const selected = pick.submissionId === sub.id && (pick.department || "") === dept ? " selected" : "";
            const name = (dept && S.L.deptById(dept).name) || "unfiled";
            return '<option value="' + value + '"' + selected + ">" + S.esc(name + " — " + (sub.label || S.host(sub))) + "</option>";
          });
        }));
        return "<p><label><i class=\"mark\">" + team.mark + "</i> " + S.esc(team.name) +
          ' <select data-act="spotlight" data-team="' + team.id + '">' + options.join("") + "</select></label></p>";
      }).join("");
  },

  present() {
    const run = ShowRender.run();
    if (!run.length) {
      S.app.innerHTML = '<section class="stage-slide"><h1>Pick the spotlights first</h1><p><a href="#/spotlight">Spotlight</a></p></section>';
      return;
    }
    const item = run[Math.min(S.presentAt, run.length - 1)];
    const dept = S.L.deptById(item.department);
    const src = S.openUrl(item.sub);
    S.app.innerHTML = '<header class="banner"><strong>' + S.esc(dept ? dept.name : "Spotlight") + "</strong><span>" +
      S.esc(item.team.name) + (item.sub.label ? " · " + S.esc(item.sub.label) : "") + "</span></header>" +
      (src ? '<iframe class="sim" src="' + S.esc(src) + '" title="' + S.esc(item.team.name) + '"></iframe>' : "<p>No link.</p>") +
      '<p class="keys">Arrow keys · ' + (Math.min(S.presentAt, run.length - 1) + 1) + " / " + run.length + "</p>";
  },

  sheet() {
    S.app.innerHTML = '<h1>Form</h1><p class="lead">Copy the response grid from the sheet, including the header, and paste it here. That replaces the practice demos. One link covering several departments is filed under all of them. Four links get matched to that list when the counts agree.</p>' +
      '<div class="paste"><textarea id="sheet-paste" placeholder="Timestamp, Team, Departments Covered, Submission 1…"></textarea>' +
      '<p class="row"><button type="button" data-act="import">File these rows</button>' +
      '<button type="button" data-act="download">Download submissions.json</button>' +
      '<button type="button" class="quiet" data-act="reset">Clear this computer</button></p>' +
      '<p id="sheet-note" class="quiet-note"></p></div>' +
      "<p class=\"quiet-note\">Save the download as session-1-matter/show/submissions.json and run <code>node clone.mjs</code>. Repos land in entries/.</p>";
  },

  run() {
    return S.L.TEAMS.map((team) => {
      const pick = (S.state.spotlights || {})[team.id];
      if (!pick || !pick.submissionId) return null;
      const sub = S.submission(pick.submissionId);
      return sub ? { team: team, sub: sub, department: pick.department } : null;
    }).filter(Boolean);
  },

  choices() {
    const now = S.standing();
    const choices = {};
    S.L.TEAMS.forEach((team) => {
      choices[team.id] = [];
      S.teamSubs(team.id).forEach((sub) => {
        (sub.departments || []).forEach((dept) => {
          const place = (now.perDept[dept].places || []).find((row) => row.team === team.id);
          choices[team.id].push({ submissionId: sub.id, department: dept, points: place ? place.points : 0 });
        });
      });
    });
    return choices;
  },
};

function ratingLine(deptId, teamId) {
  const rating = ((S.state.ratings[deptId] || {})[teamId]) || {};
  return ["useful", "beautiful", "smooth"].map((key) => {
    const options = ["", 1, 2, 3, 4, 5].map((n) => '<option value="' + n + '"' +
      (String(rating[key] || "") === String(n) ? " selected" : "") + ">" + (n || "–") + "</option>").join("");
    return '<label class="scores"><span>' + key + '</span><select data-act="rate" data-dept="' + deptId +
      '" data-team="' + teamId + '" data-key="' + key + '">' + options + "</select></label>";
  }).join("");
}

function ratingExport(deptId) {
  return (S.standing().entered[deptId] || []).map((teamId) => {
    const rating = (S.state.ratings[deptId] || {})[teamId];
    if (!rating || !(rating.useful >= 1)) return "";
    return [deptId, teamId, rating.useful, rating.beautiful, rating.smooth].join(" ");
  }).filter(Boolean).join("\n");
}

function openTile(sub, team, cls, key, badge) {
  return '<a class="cell tile' + cls + '" data-tile="' + key + '" href="#/teams/' + team.id + "/" + sub.id + '">' +
    S.thumb(sub) + (badge || "") + "</a>";
}

function practiceNote() {
  if (!S.state.practice) return "";
  return '<p class="callout">Practice entries, reused from yesterday’s recipes. Paste the <a href="#/sheet">form</a> when it arrives and these are replaced. History is a solo 4. Wellbeing is an empty column. The rest are face-offs.</p>';
}

function rankNote(result, teams, deptId) {
  if (result.state === "ranked") {
    return '<p class="lead">' + result.places.map((place) => S.L.teamById(place.team).name + " " + place.points).join(" · ") + "</p>";
  }
  if (result.state === "tie") {
    const ordered = ((S.state.tieOrders || {})[deptId] || []).filter((id) => teams.includes(id));
    const rows = result.rows.filter((row) => !ordered.includes(row.team) && result.rows.some((other) => other.team !== row.team && other.sum === row.sum));
    return '<div class="tie-actions"><p>These scores tie. Click the higher place first.</p>' +
      rows.map((row) => '<button type="button" data-act="break" data-dept="' + deptId + '" data-team="' + row.team + '">' +
        S.esc(S.L.teamById(row.team).name) + (ordered.length ? " places next" : " takes the higher place") + "</button>").join("") +
      (ordered.length ? '<button type="button" class="quiet" data-act="clear-tie" data-dept="' + deptId + '">Clear this tie</button>' : "") +
      "</div>";
  }
  return '<p class="warn">Waiting on useful, beautiful, and smooth — each from 1 to 5.</p>';
}
