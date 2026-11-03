/* Router, saved state, and the actions on the closing show. */
(function () {
  const L = ShowLogic;
  const KEY = "hackathon-show-v1";
  const app = document.querySelector("#app");
  const treeEl = document.querySelector("#tree");
  const crumbEl = document.querySelector("#crumb");
  let state = load();
  let revealAt = 0;
  let presentAt = 0;
  let openStage = "pack";
  let lastView = "";

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && saved.submissions) return saved;
    } catch (e) { /* private mode */ }
    return blank();
  }

  function blank() {
    return { submissions: [], ratings: {}, tieOrders: {}, overallOrder: [], spotlights: {} };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function safeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, location.href);
      if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:") return url.href;
    } catch (e) { /* not a url */ }
    return "";
  }

  function practiceList() {
    return (window.ShowPractice || []).map((sub) => Object.assign({}, sub, { departments: sub.departments.slice() }));
  }

  function standing() {
    return L.standings(state.submissions, state.ratings, state.tieOrders);
  }

  function submission(id) {
    return state.submissions.find((sub) => sub.id === id);
  }

  function teamSubs(teamId) {
    return state.submissions.filter((sub) => sub.team === teamId);
  }

  function covering(teamId, deptId) {
    return state.submissions.find((sub) => !sub.dq && sub.team === teamId && (sub.departments || []).includes(deptId));
  }

  function openUrl(sub) {
    return safeUrl(sub && (sub.url || sub.repo));
  }

  function host(sub) {
    if (sub && sub.practice) return "practice sim";
    const href = openUrl(sub);
    return href ? new URL(href).host.replace(/^www\./, "") : "no link";
  }

  function subName(sub) {
    const names = (sub.departments || []).map((id) => L.deptById(id)?.name || id).join(", ");
    return sub.label || names || host(sub);
  }

  function thumb(sub) {
    const dept = (sub.departments && sub.departments[0]) || "open";
    const label = esc(sub.label || subName(sub));
    if (sub.thumb) {
      return '<div class="thumb poster shot ' + esc(dept) + '"><img alt="" src="' + esc(sub.thumb) + '"><span>' + label + "</span></div>";
    }
    return '<div class="thumb poster ' + esc(dept) + '"><span>' + label + "</span></div>";
  }

  function card(sub) {
    return '<a class="card" href="#/teams/' + sub.team + "/" + sub.id + '">' + thumb(sub) +
      '<div class="meta"><strong>' + esc(subName(sub)) + "</strong><br><small>" +
      (sub.dq ? "not scored, no public link" : esc(host(sub))) + "</small></div></a>";
  }

  function publish() {
    window.S = {
      L, app, treeEl, crumbEl, state, esc, safeUrl, standing, submission, teamSubs,
      covering, openUrl, host, subName, thumb, card, revealAt, presentAt, openStage,
      WORDS: { 4: "Fourth", 3: "Third", 1: "First" },
    };
  }

  function hashParts() {
    return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  }

  function route() {
    const parts = hashParts();
    const view = parts[0] || "all";
    if (view !== lastView) {
      if (view === "reveal") revealAt = 0;
      if (view === "present") presentAt = 0;
      lastView = view;
    }
    if (view === "reveal") {
      const now = standing();
      if (!now.pending) {
        const steps = L.revealScript(now.totals, state.overallOrder);
        if (revealAt > steps.length - 1) revealAt = Math.max(0, steps.length - 1);
      }
    }
    document.body.className = view === "reveal" || view === "present" ? "stage" : view === "judge" ? "judge" : "";
    publish();
    ShowRender.tree(view, parts[1]);
    ShowRender.crumb(parts);
    if (view === "board") ShowRender.board();
    else if (view === "teams" && parts[2]) ShowRender.entry(parts[2]);
    else if (view === "teams" && parts[1]) ShowRender.team(parts[1]);
    else if (view === "departments" && parts[1]) ShowRender.dept(parts[1], false);
    else if (view === "departments") ShowRender.deptIndex();
    else if (view === "judge") ShowRender.dept(parts[1], true);
    else if (view === "reveal") ShowRender.reveal();
    else if (view === "spotlight") ShowRender.spotlight();
    else if (view === "present") ShowRender.present();
    else if (view === "sheet") ShowRender.sheet();
    else ShowRender.all();
  }

  app.addEventListener("change", (event) => {
    const el = event.target;
    const sub = el.dataset.id && submission(el.dataset.id);
    if (el.dataset.act === "dept" && sub) {
      const has = (sub.departments || []).includes(el.dataset.dept);
      if (el.checked && !has) sub.departments = (sub.departments || []).concat(el.dataset.dept);
      if (!el.checked && has) sub.departments = sub.departments.filter((id) => id !== el.dataset.dept);
      save();
      route();
    } else if (el.dataset.act === "field" && sub) {
      sub[el.dataset.field] = el.value.trim();
      save();
    } else if (el.dataset.act === "rate") {
      const bucket = state.ratings[el.dataset.dept] || (state.ratings[el.dataset.dept] = {});
      const rating = bucket[el.dataset.team] || (bucket[el.dataset.team] = {});
      rating[el.dataset.key] = Number(el.value);
      save();
      route();
    } else if (el.dataset.act === "spotlight") {
      const bits = el.value.split("|");
      if (!bits[0]) delete state.spotlights[el.dataset.team];
      else state.spotlights[el.dataset.team] = { submissionId: bits[0], department: bits[1] || "" };
      save();
      route();
    }
  });

  app.addEventListener("click", (event) => {
    const el = event.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "import") {
      const next = L.parseSheet(document.querySelector("#sheet-paste").value);
      const note = document.querySelector("#sheet-note");
      if (!next.length) { note.textContent = "No team rows in that paste. Include the header."; return; }
      state.submissions = next;
      state.practice = false;
      state.ratings = {};
      state.tieOrders = {};
      state.overallOrder = [];
      state.spotlights = {};
      openStage = "pack";
      save();
      location.hash = "#/all";
    } else if (act === "download") {
      const blob = new Blob([JSON.stringify({ submissions: state.submissions }, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "submissions.json";
      link.click();
    } else if (act === "reset" && confirm("Clear scores and restore the practice demos?")) {
      localStorage.removeItem(KEY);
      state = blank();
      state.submissions = practiceList();
      state.practice = true;
      openStage = "pack";
      save();
      location.hash = "#/all";
      route();
    } else if (act === "paste-ratings") {
      L.parseRatings(document.querySelector("#rate-paste").value).forEach((rating) => {
        const bucket = state.ratings[rating.dept] || (state.ratings[rating.dept] = {});
        bucket[rating.team] = { useful: rating.useful, beautiful: rating.beautiful, smooth: rating.smooth };
      });
      save();
      route();
    } else if (act === "break") {
      const list = state.tieOrders[el.dataset.dept] || (state.tieOrders[el.dataset.dept] = []);
      if (!list.includes(el.dataset.team)) list.push(el.dataset.team);
      save();
      route();
    } else if (act === "clear-tie") {
      state.tieOrders[el.dataset.dept] = [];
      save();
      route();
    } else if (act === "break-overall") {
      if (!state.overallOrder.includes(el.dataset.team)) state.overallOrder.push(el.dataset.team);
      save();
      route();
    } else if (act === "clear-overall") {
      const steps = L.revealScript(standing().totals, state.overallOrder);
      const tied = new Set((steps[revealAt] && steps[revealAt].teams) || []);
      state.overallOrder = state.overallOrder.filter((id) => !tied.has(id));
      save();
      route();
    } else if (act === "file-depts") {
      const boxes = measureTiles();
      openStage = "filed";
      route();
      playFlip(boxes);
    } else if (act === "score-solos") {
      openStage = "scored";
      route();
    } else if (act === "replay-open") {
      openStage = "pack";
      route();
    } else if (act === "suggest") {
      publish();
      const pick = L.suggestSpotlights(ShowRender.choices());
      state.spotlights = {};
      Object.keys(pick).forEach((teamId) => {
        state.spotlights[teamId] = { submissionId: pick[teamId].submissionId, department: pick[teamId].department };
      });
      save();
      route();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("button, a, input, textarea, select")) return;
    const view = hashParts()[0];
    if (view === "reveal" && (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === " ")) {
      const now = standing();
      if (now.pending) return;
      const steps = L.revealScript(now.totals, state.overallOrder);
      if (steps[revealAt] && steps[revealAt].kind === "tie" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      revealAt = event.key === "ArrowLeft" ? Math.max(0, revealAt - 1) : Math.min(steps.length - 1, revealAt + 1);
      route();
    } else if (view === "present" && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      publish();
      const run = ShowRender.run();
      if (!run.length) return;
      event.preventDefault();
      presentAt = (presentAt + (event.key === "ArrowLeft" ? run.length - 1 : 1)) % run.length;
      route();
    }
  });

  function measureTiles() {
    const boxes = {};
    app.querySelectorAll("[data-tile]").forEach((el) => {
      boxes[el.dataset.tile] = el.getBoundingClientRect();
    });
    return boxes;
  }

  function playFlip(boxes) {
    app.querySelectorAll("[data-tile]").forEach((el) => {
      const first = boxes[el.dataset.tile];
      if (!first) return;
      const next = el.getBoundingClientRect();
      const dx = first.left - next.left;
      const dy = first.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = "translate(" + dx + "px, " + dy + "px)";
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        app.querySelectorAll("[data-tile]").forEach((el) => {
          if (!el.style.transform) return;
          el.style.transition = "transform 0.75s cubic-bezier(0.2, 0.8, 0.2, 1)";
          el.style.transform = "none";
        });
      });
    });
  }

  async function boot() {
    try {
      const response = await fetch("submissions.json", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const incoming = data.submissions || [];
        const sig = (list) => list.map((sub) => sub.id + ":" + (sub.thumb || "") + ":" + (sub.dq ? "dq" : "")).join("\n");
        const savedIds = sig(state.submissions);
        const nextIds = sig(incoming);
        const savedReal = state.practice === false && state.submissions.length;
        if (incoming.length && (!savedReal || savedIds !== nextIds)) {
          state.submissions = incoming;
          state.practice = false;
          if (!savedReal) {
            state.ratings = {};
            state.tieOrders = {};
            state.overallOrder = [];
            state.spotlights = {};
          }
          save();
        }
      }
    } catch (e) { /* opened as a file, or offline */ }
    if (state.practice !== false && !state.submissions.length) {
      state.submissions = practiceList();
      state.practice = true;
      save();
    }
    if (!location.hash) history.replaceState(null, "", "#/all");
    route();
    window.addEventListener("hashchange", route);
    window.addEventListener("resize", () => {
      if ((hashParts()[0] || "all") === "all" && openStage === "pack") ShowRender.fitPack();
    });
  }

  boot();
})();
