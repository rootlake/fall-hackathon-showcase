/* Stand-ins until the 3:00 form is pasted. Four session-1 recipes, reused. */
(function (root) {
  const drag = "../reference/recipes/drag-spawn.html";
  const pendulum = "../reference/recipes/pendulum-chain.html";
  const wind = "../reference/recipes/sensor-wind.html";
  const measure = "../reference/recipes/measure-reset.html";
  const bench = "../reference/index.html";

  function row(team, n, url, dept, label) {
    return { id: team + "-" + n, team: team, url: url, repo: "", departments: [dept], label: label, practice: true, hint: [] };
  }

  root.ShowPractice = [
    row("momentum", 1, drag, "science", "Physics · Forces"),
    row("momentum", 2, pendulum, "math", "Geometry · Balance"),
    row("momentum", 3, wind, "art", "Drawing · Wind"),
    row("momentum", 4, measure, "english", "Poetry · Meter"),

    row("amplitude", 1, pendulum, "science", "Physics · Orbits"),
    row("amplitude", 2, measure, "math", "Statistics · Drops"),
    row("amplitude", 3, bench, "english", "Shakespeare · Falls"),
    row("amplitude", 4, drag, "art", "Ceramics · Clay"),

    row("torque", 1, wind, "science", "Chemistry · Gas"),
    row("torque", 2, drag, "math", "Algebra · Balance"),
    row("torque", 3, pendulum, "history", "World History · Clocks"),
    row("torque", 4, bench, "languages", "Latin · Levers"),

    row("wavelength", 1, measure, "math", "Calculus · Rates"),
    row("wavelength", 2, wind, "english", "Writing · Gusts"),
    row("wavelength", 3, pendulum, "art", "Music · Swing"),
    row("wavelength", 4, drag, "languages", "French · Collisions"),
  ];
})(typeof globalThis !== "undefined" ? globalThis : this);
