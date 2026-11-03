import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = {};
vm.runInNewContext(readFileSync(new URL("./logic.js", import.meta.url), "utf8"), context);
const L = context.ShowLogic;

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const sheet = [
  "Timestamp\tTeam\tDepartments Covered\tSubmission 1\tSubmission 2\tSubmission 3\tSubmission 4",
  "3:01:00 PM\tTeam Momentum\tScience, Math, English, Art\thttps://mo.example/s\thttps://mo.example/m\thttps://mo.example/e\thttps://github.com/mo/art",
  "3:02:00 PM\tAmplitude\tWorld Languages\thttps://amp.example",
  "3:03:00 PM\tTorque\tScience, Math, English\thttps://tq.example/one\thttps://tq.example/two\t\t",
].join("\n");

const parsed = L.parseSheet(sheet);
assert(parsed.length === 4 + 1 + 2, "row count " + parsed.length);
const momentum = parsed.filter((s) => s.team === "momentum");
assert(momentum.length === 4, "momentum links");
assert(momentum[0].departments[0] === "science", "zipped science");
assert(momentum[3].repo.includes("github.com/mo/art"), "repo split out");
assert(momentum[3].departments[0] === "art", "zipped art");
const amp = parsed.find((s) => s.team === "amplitude");
assert(amp.departments[0] === "languages" && amp.url === "https://amp.example", "one link covers the one department");
const torque = parsed.filter((s) => s.team === "torque");
assert(torque.length === 2 && torque.every((s) => s.departments.length === 0), "mismatched counts stay unfiled");
assert(torque[0].hint[0] === "science" && torque[0].hint[2] === "english", "hint keeps form order");

const quoted = L.parseSheet('Team,Departments Covered,Submission 1,Submission 2,Submission 3,Submission 4\nWavelength,"Art, History","https://wl.example/a","https://wl.example/h",,');
assert(quoted.length === 2 && quoted[1].departments[0] === "history", "csv quotes");

const ratings = L.parseRatings("science momentum 5 4 5\nScience Torque 3 3 4\n");
assert(ratings.length === 2 && ratings[1].team === "torque" && ratings[1].beautiful === 3, "rating paste");

const solo = L.columnResult(["wavelength"], {}, []);
assert(solo.state === "solo" && solo.places[0].points === 4, "lone team takes 4");

const waiting = L.columnResult(["momentum", "torque"], { momentum: { useful: 5, beautiful: 5, smooth: 5 } }, []);
assert(waiting.state === "needs-judges", "partial ratings wait");

const ranked = L.columnResult(["momentum", "torque"], {
  momentum: { useful: 5, beautiful: 4, smooth: 5 },
  torque: { useful: 3, beautiful: 3, smooth: 4 },
}, []);
assert(ranked.state === "ranked" && ranked.places[0].team === "momentum" && ranked.places[0].points === 4, "winner gets 4");
assert(ranked.places[1].points === 3, "runner-up gets 3");

const tied = L.columnResult(["momentum", "torque"], {
  momentum: { useful: 4, beautiful: 4, smooth: 4 },
  torque: { useful: 5, beautiful: 4, smooth: 3 },
}, []);
assert(tied.state === "tie", "equal sums tie");
const broken = L.columnResult(["momentum", "torque"], {
  momentum: { useful: 4, beautiful: 4, smooth: 4 },
  torque: { useful: 5, beautiful: 4, smooth: 3 },
}, ["torque", "momentum"]);
assert(broken.state === "ranked" && broken.places[0].team === "torque", "tie order breaks the sum");

const submissions = [
  { id: "momentum-1", team: "momentum", departments: ["science"] },
  { id: "torque-1", team: "torque", departments: ["science"] },
  { id: "wavelength-1", team: "wavelength", departments: ["languages"] },
];
const board = L.standings(submissions, {
  science: {
    momentum: { useful: 5, beautiful: 5, smooth: 5 },
    torque: { useful: 2, beautiful: 2, smooth: 2 },
  },
}, {});
assert(board.totals.momentum === 4 && board.totals.torque === 3 && board.totals.wavelength === 4, "standings add up");
assert(board.totals.amplitude === 0 && board.pending === false, "missing team scores zero");

const lateBoard = L.standings([
  { id: "w", team: "wavelength", departments: ["history"] },
  { id: "t", team: "torque", departments: ["history"], late: "after" },
], {}, {}, { history: ["wavelength", "torque"] });
assert(lateBoard.perDept.history.places[0].points === 4, "first stays 4");
assert(lateBoard.perDept.history.places[1].team === "torque" && lateBoard.perDept.history.places[1].points === 2, "late second loses a point");

const script = L.revealScript({ momentum: 12, amplitude: 9, torque: 9, wavelength: 4 }, []);
assert(script[0].place === 4 && script[0].team === "wavelength", "fourth is called first");
assert(script[1].kind === "tie" && script[1].before === 3, "a tie for third stops the show");
assert(!script.some((step) => step.place === 1), "first waits until the tie is broken");

const after = L.revealScript({ momentum: 12, amplitude: 9, torque: 9, wavelength: 4 }, ["amplitude", "torque"]);
assert(after.map((step) => step.place).join() === "4,3,1", "fourth, third, then first");
assert(after[2].team === "momentum", "first is the leader");
assert(!after.some((step) => step.place === 2), "second is never announced");

const pick = L.suggestSpotlights({
  momentum: [{ submissionId: "m", department: "science", points: 4 }, { submissionId: "m2", department: "math", points: 1 }],
  torque: [{ submissionId: "t", department: "science", points: 4 }],
});
assert(pick.momentum.department === "math" && pick.torque.department === "science", "spotlight prefers four departments");

const clone = L.repoClone("https://github.com/octo/sim.git/tree/main");
assert(clone.href === "https://github.com/octo/sim.git" && clone.name === "sim", "clone url stops at the repo");

console.log("show logic ok");
