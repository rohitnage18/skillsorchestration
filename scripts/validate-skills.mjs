import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const workspaceRoot = process.cwd();
const conductorRoot = path.join(workspaceRoot, "conductor-app");

process.chdir(conductorRoot);

const skillStorageUrl = pathToFileURL(path.join(conductorRoot, "lib", "skillStorage.js"));
const { listSkills, validateSkill } = await import(skillStorageUrl.href);

const results = listSkills().map((skill) => ({
  name: skill.name,
  validation: validateSkill(skill.name),
}));

for (const { name, validation } of results) {
  console.log(
    `${name}: ${validation.status} (${validation.failCount} failures, ${validation.warnCount} warnings)`
  );

  for (const check of validation.checks.filter((entry) => entry.status !== "pass")) {
    console.log(`  - ${check.status}: ${check.label} — ${check.detail}`);
  }
}

const failed = results.filter(({ validation }) => validation.failCount > 0);
if (failed.length > 0) {
  console.error(`Skill validation failed for ${failed.length} of ${results.length} skills.`);
  process.exit(1);
}

const warned = results.filter(({ validation }) => validation.warnCount > 0);
console.log(
  `Validated ${results.length} skills: 0 structural failures, ${warned.length} skills with governance warnings.`
);
