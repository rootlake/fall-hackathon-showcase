/* Clone each submitted GitHub repo into entries/<team>/<repo>.
   Save submissions.json here first (the show page can download it). */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const context = {};
vm.runInNewContext(readFileSync(join(root, "logic.js"), "utf8"), context);
const data = JSON.parse(readFileSync(join(root, "submissions.json"), "utf8"));
const submissions = data.submissions || [];
if (!submissions.length) {
  console.log("submissions.json is empty. Paste the form into the show, then download submissions.json into this folder.");
  process.exit(0);
}

let cloned = 0;
for (const sub of submissions) {
  const repo = context.ShowLogic.repoClone(sub.repo) || context.ShowLogic.repoClone(sub.url);
  if (!repo) {
    console.log("skip", sub.id, sub.url || "(no GitHub repo)");
    continue;
  }
  const dest = join(root, "entries", sub.team, repo.name);
  if (existsSync(join(dest, ".git"))) {
    console.log("have", dest);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  console.log("clone", repo.href);
  execFileSync("git", ["clone", "--depth", "1", repo.href, dest], { stdio: "inherit" });
  cloned += 1;
}
console.log(cloned ? "cloned " + cloned : "nothing new to clone");
