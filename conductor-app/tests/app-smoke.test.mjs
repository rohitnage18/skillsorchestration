import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getSkillInsights,
  listSkills,
  loadLatestSkillQaReport,
  saveSkillQaReport,
  validateSkill,
} from "../lib/skillStorage.js";

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

test("admin user management exposes a protected add-user flow", () => {
  const adminSource = fs.readFileSync(path.join(process.cwd(), "app", "admin", "page.jsx"), "utf-8");
  const authSource = fs.readFileSync(path.join(process.cwd(), "lib", "auth.js"), "utf-8");
  const formSource = fs.readFileSync(path.join(process.cwd(), "app", "admin", "InviteUserForm.jsx"), "utf-8");
  const usersApiSource = fs.readFileSync(path.join(process.cwd(), "app", "api", "users", "route.ts"), "utf-8");
  const globalStyles = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf-8");

  assert.match(adminSource, /<InviteUserForm \/>/);
  assert.match(adminSource, /href='#user-management'/);
  assert.match(adminSource, /id='user-management'/);
  assert.match(adminSource, /Build the team behind every governed skill/);
  assert.match(adminSource, /aria-labelledby="team-access-heading"/);
  assert.match(adminSource, /role="list"/);
  assert.match(adminSource, /Agent identity for/);
  assert.match(formSource, /Invite a teammate/);
  assert.match(formSource, /aria-describedby="invite-user-note"/);
  assert.match(formSource, /Work email/);
  assert.match(formSource, /Add user/);
  assert.match(formSource, /fetch\("\/api\/users"/);
  assert.match(formSource, /type="email"/);
  assert.match(formSource, /aria-live="polite"/);
  assert.match(globalStyles, /\.team-health-grid/);
  assert.match(globalStyles, /\.team-member-row/);
  assert.match(globalStyles, /@media \(max-width: 620px\)/);
  assert.match(globalStyles, /@media \(prefers-contrast: more\)/);
  assert.match(usersApiSource, /requirePermission\(request\.headers, "users:manage"\)/);
  assert.match(usersApiSource, /status: 409/);
  assert.match(usersApiSource, /action: input\.id \? "user:update" : "user:invite"/);
  assert.match(adminSource, /import \{ requireAdmin \} from "\.\.\/\.\.\/lib\/auth\.js"/);
  assert.equal(
    adminSource.match(/await requireAdmin\(\)/g)?.length,
    14,
    "The admin page and every inline server action must use the database-backed admin guard."
  );
  assert.doesNotMatch(adminSource, /session\?*\.user\?*\.role\s*!==\s*"ADMIN"/);
  assert.match(authSource, /if \(user\.status !== "ACTIVE"\)/);
  assert.match(authSource, /return requireRole\(headers, "ADMIN"\)/);
});

test("workflow route wiring keeps execution permission and ownership aligned", async () => {
  const permissionsSource = fs.readFileSync(
    path.join(process.cwd(), "lib", "permissions.js"),
    "utf-8"
  );
  const workflowExecuteRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "workflows", "[workflowId]", "execute", "route.ts"),
    "utf-8"
  );

  assert.match(permissionsSource, /"workflows:manage",\s+"workflows:use"/);
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

test("skill summary and QA report APIs are gated and use validated reports", { concurrency: false }, async () => {
  const skillName = "test-skill-app-smoke";
  createSkillFixture(skillName);

  try {
    const summarySource = fs.readFileSync(
      path.join(process.cwd(), "app", "api", "skills", "[skillName]", "summary", "route.js"),
      "utf-8"
    );
    const qaSource = fs.readFileSync(
      path.join(process.cwd(), "app", "api", "skills", "[skillName]", "qa-report", "route.js"),
      "utf-8"
    );
    assert.match(summarySource, /requirePermission\(req\.headers, "skills:use"\)/);
    assert.match(qaSource, /requirePermission\(req\.headers, "skills:use"\)/);

    const validation = validateSkill(skillName);
    const report = saveSkillQaReport(skillName, validation);
    const qaReport = loadLatestSkillQaReport(skillName);
    assert.equal(qaReport.id, report.id);
    assert.ok(qaReport.relativePath.includes("skill-qa-reports"));
  } finally {
    cleanupSkillFixture(skillName);
  }
});
