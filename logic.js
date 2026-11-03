/* Scoring and sheet-import rules for the closing show.
   A department with one team pays 4. A face-off ranks the teams that showed
   up and pays 4, then 3, then 2, then 1. Ties stay ties until someone orders them. */
(function (root) {
  const TEAMS = [
    { id: "momentum", name: "Momentum", mark: "p", members: ["Luke", "Brady", "Brett", "Shomarie"] },
    { id: "amplitude", name: "Amplitude", mark: "A", members: ["Cayden", "James H.", "Christoph", "Ronan"] },
    { id: "torque", name: "Torque", mark: "τ", members: ["HQ", "Keke", "Mike", "Ryan"] },
    { id: "wavelength", name: "Wavelength", mark: "λ", members: ["James L.", "Colby", "Justus", "Elias"] },
  ];

  const DEPTS = [
    { id: "science", name: "Science" },
    { id: "math", name: "Math" },
    { id: "art", name: "Art", also: ["arts"] },
    { id: "history", name: "History" },
    { id: "english", name: "English" },
    { id: "languages", name: "World Languages", also: ["world languages", "languages", "language"] },
    { id: "wellbeing", name: "Wellbeing", also: ["well-being", "well being"] },
  ];

  const PAY = [4, 3, 2, 1];

  function teamById(id) { return TEAMS.find((t) => t.id === id); }
  function deptById(id) { return DEPTS.find((d) => d.id === id); }

  function matchTeam(text) {
    const s = String(text || "").trim().toLowerCase().replace(/^team\s+/, "");
    return TEAMS.find((t) => s === t.id || s === t.name.toLowerCase())?.id || "";
  }

  function deptIdsIn(text) {
    // URLs are not department names: a repo called "art" must not file itself.
    const source = String(text || "").replace(/https?:\/\/\S+/g, " ");
    const hits = [];
    for (const dept of DEPTS) {
      const names = [dept.name].concat(dept.also || []).sort((a, b) => b.length - a.length);
      let at = -1;
      for (const name of names) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = new RegExp("\\b" + escaped + "\\b", "i").exec(source);
        if (match && (at === -1 || match.index < at)) at = match.index;
      }
      if (at !== -1) hits.push({ id: dept.id, at: at });
    }
    hits.sort((a, b) => a.at - b.at);
    return hits.map((hit) => hit.id);
  }

  function splitLink(cell) {
    const raw = String(cell || "").trim();
    const urls = raw.match(/https?:\/\/[^\s<>"']+/g) || [];
    let repo = "";
    let live = "";
    urls.forEach((url) => {
      const clean = url.replace(/[),.;]+$/, "");
      if (/github\.com\/[^/]+\/[^/]+/i.test(clean) && !/github\.io/i.test(clean)) repo = repo || clean;
      else live = live || clean;
    });
    if (!live && !repo && /^https?:\/\//i.test(raw)) live = raw.split(/\s/)[0];
    return { url: live, repo: repo };
  }

  function parseTable(text) {
    const source = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!source.trim()) return [];
    const first = source.split("\n")[0];
    let outside = true;
    let tabs = 0;
    let commas = 0;
    for (let i = 0; i < first.length; i++) {
      if (first[i] === '"') outside = !outside;
      else if (outside && first[i] === "\t") tabs++;
      else if (outside && first[i] === ",") commas++;
    }
    const delim = tabs >= commas ? "\t" : ",";
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < source.length; i++) {
      const c = source[i];
      if (quoted) {
        if (c === '"') {
          if (source[i + 1] === '"') { cell += '"'; i++; }
          else quoted = false;
        } else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim()));
  }

  function headerIndex(head, test) {
    return head.findIndex((h) => test(h.trim().toLowerCase()));
  }

  function parseSheet(text) {
    const rows = parseTable(text);
    if (!rows.length) return [];
    const head = rows[0].map((h) => String(h || ""));
    const teamCol = headerIndex(head, (h) => h === "team");
    const deptCol = headerIndex(head, (h) => h.includes("department"));
    const subCols = [];
    head.forEach((h, i) => { if (/submission\s*\d/.test(h.toLowerCase())) subCols.push(i); });
    const body = teamCol === -1 ? rows : rows.slice(1);
    const submissions = [];
    body.forEach((row) => {
      const team = matchTeam(teamCol === -1 ? "" : row[teamCol]);
      if (!team) return;
      const listed = deptIdsIn(deptCol === -1 ? "" : row[deptCol]);
      const links = (subCols.length ? subCols : [0]).map((i) => {
        const raw = row[i] || "";
        return Object.assign(splitLink(raw), { inline: deptIdsIn(raw) });
      }).filter((link) => link.url || link.repo);
      const inlined = links.length > 0 && links.every((link) => link.inline.length === 1);
      links.forEach((link, index) => {
        let departments = [];
        if (inlined) departments = [link.inline[0]];
        else if (links.length === 1) departments = listed.slice();
        else if (listed.length === links.length) departments = [listed[index]];
        submissions.push({
          id: team + "-" + (index + 1),
          team: team,
          url: link.url,
          repo: link.repo,
          departments: departments,
          label: "",
          hint: departments.length ? [] : listed,
        });
      });
    });
    return submissions;
  }

  function parseRatings(text) {
    const ratings = [];
    String(text || "").split(/\n/).forEach((line) => {
      const bits = line.trim().split(/[\s,|·]+/).filter(Boolean);
      if (bits.length < 5) return;
      const nums = bits.slice(-3).map(Number);
      if (nums.some((n) => !(n >= 1 && n <= 5))) return;
      const dept = deptIdsIn(bits[0])[0] || (deptById(bits[0].toLowerCase()) && bits[0].toLowerCase());
      const team = matchTeam(bits.slice(1, -3).join(" "));
      if (!dept || !team) return;
      ratings.push({ dept: dept, team: team, useful: nums[0], beautiful: nums[1], smooth: nums[2] });
    });
    return ratings;
  }

  function columnResult(teamIds, ratings, tieOrder) {
    const ids = teamIds.filter((id, i) => teamIds.indexOf(id) === i);
    if (!ids.length) return { state: "empty", places: [] };
    if (ids.length === 1) return { state: "solo", places: [{ team: ids[0], points: 4, sum: null }] };
    const rows = ids.map((team) => {
      const rating = (ratings || {})[team];
      const ready = !!rating && [rating.useful, rating.beautiful, rating.smooth].every((n) => n >= 1 && n <= 5);
      return {
        team: team,
        ready: ready,
        sum: ready ? rating.useful + rating.beautiful + rating.smooth : null,
        rating: ready ? rating : null,
      };
    });
    if (rows.some((row) => !row.ready)) return { state: "needs-judges", rows: rows, places: [] };
    rows.sort((a, b) => b.sum - a.sum || a.team.localeCompare(b.team));
    const order = tieOrder || [];
    const sums = rows.map((row) => row.sum);
    const contested = rows.filter((row, i) => sums.indexOf(row.sum) !== i || sums.lastIndexOf(row.sum) !== i);
    const broken = contested.length > 0 && contested.every((row) => order.includes(row.team));
    if (contested.length && !broken) return { state: "tie", rows: rows, places: [] };
    if (broken) {
      rows.sort((a, b) => b.sum - a.sum || order.indexOf(a.team) - order.indexOf(b.team));
    }
    return { state: "ranked", rows: rows, places: rows.map((row, i) => Object.assign({}, row, { points: PAY[i] })) };
  }

  function entriesByDept(submissions) {
    const map = {};
    DEPTS.forEach((d) => { map[d.id] = []; });
    (submissions || []).forEach((sub) => {
      if (sub.dq) return;
      (sub.departments || []).forEach((dept) => {
        if (!map[dept]) map[dept] = [];
        if (!map[dept].includes(sub.team)) map[dept].push(sub.team);
      });
    });
    return map;
  }

  function standings(submissions, ratings, tieOrders, orders) {
    const entered = entriesByDept(submissions);
    const perDept = {};
    const totals = {};
    TEAMS.forEach((team) => { totals[team.id] = 0; });
    let pending = false;
    DEPTS.forEach((dept) => {
      const listed = ((orders || {})[dept.id] || []).filter((id) => entered[dept.id].includes(id));
      const result = listed.length === entered[dept.id].length && listed.length > 1
        ? { state: "ranked", places: listed.map((team, i) => ({ team: team, points: PAY[i], sum: null })) }
        : columnResult(entered[dept.id], (ratings || {})[dept.id], (tieOrders || {})[dept.id]);
      perDept[dept.id] = result;
      if (result.state === "needs-judges" || result.state === "tie") pending = true;
      (result.places || []).forEach((place) => { totals[place.team] += place.points; });
    });
    return { entered: entered, perDept: perDept, totals: totals, pending: pending };
  }

  function placeGroups(totals, tieOrder) {
    const ids = Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
    const grouped = [];
    ids.forEach((id) => {
      const last = grouped[grouped.length - 1];
      if (last && last.points === totals[id]) last.teams.push(id);
      else grouped.push({ points: totals[id], teams: [id] });
    });
    const order = tieOrder || [];
    const flat = [];
    grouped.forEach((group) => {
      const resolved = group.teams.length > 1 && group.teams.every((id) => order.includes(id));
      if (!resolved) { flat.push(group); return; }
      order.filter((id) => group.teams.includes(id)).forEach((id) => {
        flat.push({ points: group.points, teams: [id], broken: true });
      });
    });
    let place = 1;
    return flat.map((group) => {
      const from = place;
      place += group.teams.length;
      return { points: group.points, teams: group.teams.slice(), from: from, to: place - 1 };
    });
  }

  function revealScript(totals, tieOrder) {
    const groups = placeGroups(totals, tieOrder);
    if (!groups.length) return [];
    function sole(n) { return groups.find((g) => g.from === n && g.to === n); }
    function tiedAcross(n) { return groups.find((g) => g.teams.length > 1 && g.from <= n && g.to >= n); }
    const steps = [];
    const fourthTie = tiedAcross(4);
    const fourth = sole(4);
    if (fourthTie) steps.push({ kind: "tie", before: 4, teams: fourthTie.teams.slice(), points: fourthTie.points });
    else if (fourth) steps.push({ kind: "place", place: 4, team: fourth.teams[0], points: fourth.points });
    if (!fourthTie) {
      const thirdTie = tiedAcross(3);
      const third = sole(3);
      if (thirdTie) steps.push({ kind: "tie", before: 3, teams: thirdTie.teams.slice(), points: thirdTie.points });
      else if (third) steps.push({ kind: "place", place: 3, team: third.teams[0], points: third.points });
      if (!thirdTie) {
        const firstTie = tiedAcross(1);
        const first = sole(1);
        if (firstTie) steps.push({ kind: "tie", before: 1, teams: firstTie.teams.slice(), points: firstTie.points });
        else if (first) steps.push({ kind: "place", place: 1, team: first.teams[0], points: first.points });
      }
    }
    return steps;
  }

  function suggestSpotlights(choices) {
    const teams = Object.keys(choices);
    let best = { unique: -1, pts: -1, pick: {} };
    function walk(index, pts, pick, depts) {
      if (index === teams.length) {
        if (depts.length > best.unique || (depts.length === best.unique && pts > best.pts)) {
          best = { unique: depts.length, pts: pts, pick: Object.assign({}, pick) };
        }
        return;
      }
      const list = choices[teams[index]] || [];
      if (!list.length) { walk(index + 1, pts, pick, depts); return; }
      list.forEach((choice) => {
        pick[teams[index]] = choice;
        const next = depts.indexOf(choice.department) === -1 ? depts.concat(choice.department) : depts;
        walk(index + 1, pts + (choice.points || 0), pick, next);
      });
    }
    walk(0, 0, {}, []);
    return best.pick;
  }

  function repoClone(repo) {
    const match = String(repo || "").match(/github\.com[/:]([^/]+)\/([^/#?\s]+)/i);
    if (!match) return null;
    const name = match[2].replace(/\.git$/, "").replace(/[^\w.-]/g, "");
    if (!name) return null;
    return { href: "https://github.com/" + match[1] + "/" + name + ".git", name: name, owner: match[1] };
  }

  root.ShowLogic = {
    TEAMS: TEAMS,
    DEPTS: DEPTS,
    PAY: PAY,
    teamById: teamById,
    deptById: deptById,
    matchTeam: matchTeam,
    parseSheet: parseSheet,
    parseRatings: parseRatings,
    columnResult: columnResult,
    entriesByDept: entriesByDept,
    standings: standings,
    placeGroups: placeGroups,
    revealScript: revealScript,
    suggestSpotlights: suggestSpotlights,
    splitLink: splitLink,
    repoClone: repoClone,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
