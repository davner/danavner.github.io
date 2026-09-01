#!/usr/bin/env node
/**
 * Checks that every workflow which can commit to `main` is named in
 * `deploy.yml`'s `workflow_run` trigger, and that every name in that trigger
 * belongs to a workflow that exists.
 *
 *   node scripts/check-workflows.mjs
 *
 * GitHub will not start a workflow from a push made with the default
 * `GITHUB_TOKEN`, so a data job's commit lands on `main` and `deploy.yml`'s
 * `push` trigger never sees it. The only thing that carries the refresh to the
 * site is `deploy.yml` naming that job in `workflow_run.workflows` - a bare
 * string matched against a `name:` in another file, which nothing else checks.
 *
 * Both ways of breaking it are silent in the same way: the data is committed,
 * every run is green, and the page keeps serving what it last built. Adding a
 * data workflow without adding its name is one; renaming a workflow and leaving
 * the old string behind is the other. The README's "Why the data jobs are named
 * in `deploy.yml`" records what that costs.
 */
import { readdirSync, readFileSync } from "node:fs";

import { load as parseYaml } from "js-yaml";

const DIR = ".github/workflows";
const DEPLOY = "deploy.yml";

/** Whether a workflow can write to the repository, at either scope. */
function writesContents(workflow) {
  const scopes = [
    workflow?.permissions,
    ...Object.values(workflow?.jobs ?? {}).map((job) => job?.permissions),
  ];

  return scopes.some((scope) => scope === "write-all" || scope?.contents === "write");
}

const deploy = parseYaml(readFileSync(`${DIR}/${DEPLOY}`, "utf8"));
const triggers = deploy?.on?.workflow_run?.workflows ?? [];

const files = readdirSync(DIR)
  .filter((file) => /\.ya?ml$/.test(file))
  .sort();

const names = new Map();
const problems = [];

for (const file of files) {
  // The deploy is what the trigger starts, so it is never in its own list.
  if (file === DEPLOY) continue;

  const workflow = parseYaml(readFileSync(`${DIR}/${file}`, "utf8"));
  const name = workflow?.name;

  if (!name) {
    problems.push(`${file} has no \`name:\`, so ${DEPLOY} has nothing to name it by`);
    continue;
  }

  names.set(name, file);

  if (writesContents(workflow) && !triggers.includes(name)) {
    problems.push(
      `${file} commits to the repository but "${name}" is not in ${DEPLOY}'s ` +
        `workflow_run list, so what it commits would never be deployed`,
    );
  }
}

for (const trigger of triggers) {
  if (!names.has(trigger)) {
    problems.push(
      `${DEPLOY} triggers on a workflow named "${trigger}", and no workflow is called that`,
    );
  }
}

if (problems.length > 0) {
  console.error(`${DIR} and ${DEPLOY} disagree:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `${DEPLOY} triggers on every workflow that commits: ${triggers.map((n) => `"${n}"`).join(", ")}.`,
);
