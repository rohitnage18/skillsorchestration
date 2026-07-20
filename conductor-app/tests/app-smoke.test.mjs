import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GET as getSkillSummary } from "../app/api/skills/[skillName]/summary/route.js";
import { GET as getQaReport } from "../app/api/skills/[skillName]/qa-report/route.js";
import { getSkillInsights, listSkills, saveSkillQaReport, validateSkill } from "../lib/skillStorage.js";

const repoRoot = path.resolve(process.cwd(), "..");
const skillsRoot = path.join(repoRoot, "skills");

function createSkillFixture(skillName) {
  const skillDir = path.join(skillsRoot, skillName);
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: Use this skill for smoke testing and validation flows.\n---\n\n# ${skillName}\n\nUse this skill for smoke testing.\n`,
    "utf-8"
  );
  fs.writeFileSync(
    path.join(skillDir, "references", "guide.md"),
    "# Guide\n\nSmoke test reference content.\n",
    "utf-8"
  );
}

function cleanupSkillFixture(skillName) {
  fs.rmSync(path.join(skillsRoot, skillName), { recursive: true, force: true });
  fs.rmSync(path.join(process.cwd(), "data", "skill-qa-reports", skillName), { recursive: true, force: true });
}

test("home, login, and skills pages keep their primary smoke-check copy", async () => {
  const homeSource = fs.readFileSync(path.join(process.cwd(), "app", "page.js"), "utf-8");
  const loginSource = fs.readFileSync(path.join(process.cwd(), "app", "login", "page.jsx"), "utf-8");
  const skillsSource = fs.readFileSync(path.join(process.cwd(), "app", "skills", "page.js"), "utf-8");
  const skillDetailSource = fs.readFileSync(path.join(process.cwd(), "app", "skills", "[skillName]", "page.js"), "utf-8");
  const skillsApiSource = fs.readFileSync(path.join(process.cwd(), "app", "api", "skills", "route.js"), "utf-8");
  const publicIndexSource = fs.readFileSync(path.join(process.cwd(), "public", "index.html"), "utf-8");
  const publicAppSource = fs.readFileSync(path.join(process.cwd(), "public", "app.js"), "utf-8");

  assert.match(homeSource, /Browse skills/);
  assert.match(loginSource, /Sign in to Conductor Studio/);
  assert.match(skillsSource, /Browse approved skills/);
  assert.match(skillsSource, /Active skill/);
  assert.match(skillDetailSource, /This skill stays pinned here/);
  assert.match(skillsSource, /I understand this looks very similar to an existing skill/);
  assert.match(skillsApiSource, /DUPLICATE_CONFIRMATION_REQUIRED/);
  assert.doesNotMatch(skillDetailSource, /window\.prompt\("Import workspace name:/);
  assert.match(publicIndexSource, /Active skill/);
  assert.match(publicAppSource, /ACTIVE_SKILL_STORAGE_KEY/);
  assert.doesNotMatch(publicAppSource, /Enter destination folder name for imported skill/);
});

test("workflow route wiring keeps execution permission and ownership aligned", async () => {
  const authSource = fs.readFileSync(path.join(process.cwd(), "lib", "auth.js"), "utf-8");
  const workflowExecuteRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "workflows", "[workflowId]", "execute", "route.ts"),
    "utf-8"
  );

  assert.match(authSource, /"workflows:manage",\s+"workflows:use"/);
  assert.match(workflowExecuteRouteSource, /requirePermission\(req\.headers,\s*"workflows:use"\)/);
  assert.match(workflowExecuteRouteSource, /executeWorkflow\(user\.id,\s*workflowId,\s*input\)/);
  assert.doesNotMatch(workflowExecuteRouteSource, /executeWorkflow\(await getOwnerId\(req\.headers\)/);
});

test("skills data and insights remain usable for the conductor UI", async () => {
  const skills = listSkills();
  assert.ok(Array.isArray(skills));
  assert.ok(skills.length > 0);
  assert.ok(skills.every((skill) => skill.scorecard && skill.scorecard.grade));

  const insights = getSkillInsights();
  assert.ok(typeof insights.totalSkills === "number");
  assert.ok(typeof insights.stableSkills === "number");
  assert.ok(insights.scoreGradeSummary && typeof insights.scoreGradeSummary === "object");
});

test("skill summary and QA report APIs work for a validated skill", { concurrency: false }, async () => {
  const skillName = "test-skill-app-smoke";
  createSkillFixture(skillName);

  try {
    const summaryResponse = await getSkillSummary(new Request(`http://localhost/api/skills/${skillName}/summary`), {
      params: Promise.resolve({ skillName }),
    });
    const summary = await summaryResponse.json();

    assert.equal(summaryResponse.status, 200);
    assert.equal(summary.skillInfo.name, skillName);
    assert.equal(summary.hasSkillFile, true);
    assert.ok(summary.referenceCount >= 1);
    assert.ok(summary.scorecard);

    const validation = validateSkill(skillName);
    const report = saveSkillQaReport(skillName, validation);

    const qaResponse = await getQaReport(new Request(`http://localhost/api/skills/${skillName}/qa-report`), {
      params: Promise.resolve({ skillName }),
    });
    const qaReport = await qaResponse.json();

    assert.equal(qaResponse.status, 200);
    assert.equal(qaReport.id, report.id);
    assert.ok(qaReport.relativePath.includes("skill-qa-reports"));
  } finally {
    cleanupSkillFixture(skillName);
  }
});
