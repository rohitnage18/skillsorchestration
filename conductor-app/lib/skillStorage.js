import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  assertSkillFileContent,
  normalizeEditableSkillPath,
  normalizeSkillNameInput,
  sanitizeDescription,
  sanitizeText,
} from "./inputSafety.js";

const SKILLS_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), "..", "skills");
const IMPORT_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), "imported-workspaces");
const VERSION_HISTORY_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "skill-versions");
const QA_REPORTS_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "skill-qa-reports");
const STATE_FILENAME = "skill-state.json";
const MAX_VERSION_HISTORY = 50;
const STALE_SKILL_DAYS = 90;
const REVIEW_SOON_DAYS = 30;
const DEFAULT_SKILL_STATE = {
  importedTo: null,
  importedAt: null,
  tags: [],
  owner: "",
  reviewer: "",
  qualityStatus: "draft",
  lastAuditedAt: null,
  latestQaReport: null,
};
const skillStorageTestHooks = {
  db: null,
  logAction: null,
};

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  const relative = path.relative(path.resolve(base), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid path");
  }
  return resolved;
}

function normalizeSkillName(name) {
  return normalizeSkillNameInput(name);
}

function hashContent(content) {
  return crypto.createHash("sha256").update(String(content)).digest("hex");
}

function getFileType(relativePath) {
  return relativePath === "SKILL.md" ? "skill" : relativePath.startsWith("references/") ? "reference" : "other";
}

function assertEditableSkillFile(relativePath) {
  return normalizeEditableSkillPath(relativePath);
}

function encodeVersionPath(relativePath) {
  return Buffer.from(relativePath, "utf-8").toString("base64url");
}

function decodeVersionPath(encodedPath) {
  return Buffer.from(encodedPath, "base64url").toString("utf-8");
}

function getVersionHistoryDirectory(skillName) {
  return safeJoin(VERSION_HISTORY_ROOT, normalizeSkillName(skillName));
}

function getVersionHistoryFile(skillName, relativePath) {
  const safePath = assertEditableSkillFile(relativePath);
  return path.join(getVersionHistoryDirectory(skillName), `${encodeVersionPath(safePath)}.json`);
}

function readVersionHistory(skillName, relativePath) {
  const historyFile = getVersionHistoryFile(skillName, relativePath);
  if (!fs.existsSync(historyFile)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(historyFile, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVersionHistory(skillName, relativePath, versions) {
  const historyFile = getVersionHistoryFile(skillName, relativePath);
  fs.mkdirSync(path.dirname(historyFile), { recursive: true });
  fs.writeFileSync(historyFile, JSON.stringify(versions.slice(0, MAX_VERSION_HISTORY), null, 2), "utf-8");
}

async function resolveVersionActor(userId) {
  if (!userId) {
    return null;
  }

  try {
    const db = skillStorageTestHooks.db ?? (await import("./db")).db;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (user) {
      return user;
    }
  } catch (error) {
    console.error("Failed to resolve skill version actor:", error);
  }

  return {
    id: userId,
    email: `${userId}@local.conductor`,
    name: null,
    role: null,
  };
}

async function createVersionEntry({
  skillName,
  relativePath,
  content,
  userId = null,
  action = "update",
  restoredFromVersionId = null,
}) {
  return {
    id: crypto.randomUUID(),
    skillName: normalizeSkillName(skillName),
    filePath: assertEditableSkillFile(relativePath),
    fileType: getFileType(relativePath),
    createdAt: new Date().toISOString(),
    action,
    restoredFromVersionId,
    content,
    hash: hashContent(content),
    bytes: Buffer.byteLength(content, "utf-8"),
    actor: await resolveVersionActor(userId),
  };
}

async function recordSkillVersion({
  skillName,
  relativePath,
  content,
  userId,
  action = "update",
  restoredFromVersionId = null,
}) {
  const safeSkillName = normalizeSkillName(skillName);
  const safePath = assertEditableSkillFile(relativePath);
  const versions = readVersionHistory(safeSkillName, safePath);
  const version = await createVersionEntry({
    skillName: safeSkillName,
    relativePath: safePath,
    content,
    userId,
    action,
    restoredFromVersionId,
  });
  writeVersionHistory(safeSkillName, safePath, [version, ...versions]);
  return version;
}

async function seedVersionHistoryIfNeeded(skillName, relativePath, existingContent) {
  if (!existingContent) {
    return;
  }

  const safeSkillName = normalizeSkillName(skillName);
  const safePath = assertEditableSkillFile(relativePath);
  const versions = readVersionHistory(safeSkillName, safePath);
  if (versions.length > 0) {
    return;
  }

  const baselineVersion = await createVersionEntry({
    skillName: safeSkillName,
    relativePath: safePath,
    content: existingContent,
    userId: null,
    action: "baseline",
  });

  writeVersionHistory(safeSkillName, safePath, [baselineVersion]);
}

function summarizeLineDiff(previousContent, nextContent) {
  const previousLines = String(previousContent).split(/\r?\n/);
  const nextLines = String(nextContent).split(/\r?\n/);
  const total = Math.max(previousLines.length, nextLines.length);
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (let index = 0; index < total; index += 1) {
    const previousLine = previousLines[index];
    const nextLine = nextLines[index];

    if (previousLine === undefined && nextLine !== undefined) {
      added += 1;
      continue;
    }

    if (previousLine !== undefined && nextLine === undefined) {
      removed += 1;
      continue;
    }

    if (previousLine === nextLine) {
      unchanged += 1;
      continue;
    }

    changed += 1;
  }

  return {
    added,
    removed,
    changed,
    unchanged,
    previousLineCount: previousLines.length,
    nextLineCount: nextLines.length,
  };
}

function loadSkillState(skillName) {
  const skillDir = getSkillDirectory(skillName);
  const stateFile = path.join(skillDir, STATE_FILENAME);
  if (!fs.existsSync(stateFile)) {
    return { ...DEFAULT_SKILL_STATE };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    return {
      ...DEFAULT_SKILL_STATE,
      ...parsed,
      tags: Array.isArray(parsed?.tags)
        ? parsed.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
        : [],
      latestQaReport:
        parsed?.latestQaReport && typeof parsed.latestQaReport === "object"
          ? parsed.latestQaReport
          : null,
    };
  } catch {
    return { ...DEFAULT_SKILL_STATE };
  }
}

function saveSkillState(skillName, state) {
  const skillDir = ensureSkillExists(skillName);
  const stateFile = path.join(skillDir, STATE_FILENAME);
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");
}

function describeFromSkillFile(content) {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return "No description";
  }
  const descriptionMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
  return descriptionMatch ? descriptionMatch[1].trim() : "No description";
}

function parseSkillFrontmatter(content) {
  const frontmatterMatch = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return { name: "", description: "" };
  }

  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
  return {
    name: nameMatch ? nameMatch[1].trim() : "",
    description: descriptionMatch ? descriptionMatch[1].trim() : "",
  };
}

function extractSkillBody(content) {
  const normalized = String(content || "");
  const frontmatterMatch = normalized.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return frontmatterMatch ? normalized.slice(frontmatterMatch[0].length).trim() : normalized.trim();
}

function inferSkillTags(name, description, references, stateTags = []) {
  const combined = `${name} ${description} ${references.map((ref) => ref.name || ref).join(" ")}`.toLowerCase();
  const tags = new Set(
    stateTags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
  );

  const keywordMap = {
    frontend: ["frontend", "react", "vue", "svelte", "angular", "nextjs", "next.js", "tailwind", "ui", "ux"],
    backend: ["backend", "node", "python", "java", "go", "api", "server", "database", "auth"],
    testing: ["test", "qa", "quality", "validation", "regression"],
    security: ["security", "auth", "authorization", "secret", "owasp", "vulnerability", "hardening"],
    architecture: ["architecture", "adr", "c4", "integration", "nfr"],
    delivery: ["ci", "cd", "pipeline", "deploy", "release", "github actions"],
    sre: ["sre", "incident", "observability", "slo", "error budget"],
    project: ["project", "raid", "status", "schedule", "planning"],
    business: ["business", "brd", "gap", "process", "analysis"],
    documentation: ["doc", "documentation", "report"],
  };

  for (const [tag, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((keyword) => combined.includes(keyword))) {
      tags.add(tag);
    }
  }

  if (references.some((reference) => String(reference.name || reference).toLowerCase().includes("next"))) {
    tags.add("nextjs");
  }
  if (references.some((reference) => String(reference.name || reference).toLowerCase().includes("tailwind"))) {
    tags.add("tailwind");
  }

  return Array.from(tags).sort();
}

function getSkillLastUpdatedAt(skillName, files = null) {
  const skillDir = getSkillDirectory(skillName);
  const fileList = files || listSkillFiles(skillName);
  const timestamps = fileList
    .map((file) => {
      try {
        const stats = fs.statSync(path.join(skillDir, file.path));
        return stats.mtimeMs;
      } catch {
        return 0;
      }
    })
    .filter(Boolean);

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function getSkillFreshness({ lastUpdatedAt, lastAuditedAt }) {
  const referenceDate = lastAuditedAt || lastUpdatedAt;
  if (!referenceDate) {
    return { status: "unknown", ageDays: null };
  }

  const ageMs = Date.now() - new Date(referenceDate).getTime();
  const ageDays = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));

  if (ageDays >= STALE_SKILL_DAYS) {
    return { status: "stale", ageDays };
  }

  if (ageDays >= REVIEW_SOON_DAYS) {
    return { status: "review-soon", ageDays };
  }

  return { status: "recent", ageDays };
}

function calculateSkillScorecard({
  healthStatus,
  qualityStatus,
  owner,
  reviewer,
  referenceCount,
  freshnessStatus,
  triggerSummary,
  latestQaReport,
}) {
  let score = 0;

  score += healthStatus === "passed" ? 35 : healthStatus === "warning" ? 22 : 8;

  const triggerRatio =
    triggerSummary?.promptCount > 0 ? triggerSummary.matchedCount / triggerSummary.promptCount : 0;
  score += Math.round(triggerRatio * 15);

  score += referenceCount > 0 ? 10 : 4;
  score += owner ? 10 : 0;
  score += reviewer ? 5 : 0;

  if (qualityStatus === "production-ready") {
    score += 15;
  } else if (qualityStatus === "reviewed") {
    score += 10;
  } else {
    score += 4;
  }

  if (freshnessStatus === "recent") {
    score += 10;
  } else if (freshnessStatus === "review-soon") {
    score += 6;
  } else if (freshnessStatus === "stale") {
    score += 2;
  } else {
    score += 3;
  }

  if (latestQaReport) {
    score += latestQaReport.recommendation === "No-go" ? 3 : 10;
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const grade =
    normalizedScore >= 85 ? "A" : normalizedScore >= 70 ? "B" : normalizedScore >= 55 ? "C" : "D";
  const stability =
    grade === "A" && healthStatus === "passed" && freshnessStatus !== "stale" && qualityStatus !== "draft"
      ? "stable"
      : normalizedScore >= 70
        ? "watch"
        : "at-risk";

  return {
    score: normalizedScore,
    grade,
    stability,
  };
}

function tokenizeForMatching(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildTriggerPromptCandidates(skillName, tags = []) {
  const prompts = [
    `Help me with ${skillName}`,
  ];

  const promptMap = {
    frontend: [
      "Build a responsive dashboard UI",
      "Fix this React layout and improve accessibility",
    ],
    backend: [
      "Design the backend API for this feature",
      "Review this Node.js server for correctness and auth issues",
    ],
    testing: [
      "Audit this project and create test cases",
      "Act like a senior test developer and validate regressions",
    ],
    security: [
      "Run a security review on this login flow",
      "Check this app for auth and secret handling issues",
    ],
    delivery: [
      "Create a GitHub Actions CI/CD pipeline for this repo",
      "Set up branch-safe deployment checks before merge",
    ],
    architecture: [
      "Design the system architecture for this platform",
      "Choose an integration pattern for these services",
    ],
    sre: [
      "Define SLOs and monitoring for this service",
      "Help run the postmortem after this outage",
    ],
    project: [
      "Create a project plan and risk register",
      "Write a weekly project status report",
    ],
    business: [
      "Write a business case for this initiative",
      "Help with BRD and gap analysis",
    ],
    documentation: [
      "Write technical documentation for this service",
      "Create a release note and setup guide",
    ],
  };

  for (const tag of tags) {
    const examples = promptMap[tag] || [];
    for (const example of examples) {
      prompts.push(example);
    }
  }

  return Array.from(new Set(prompts)).slice(0, 6);
}

function validateSkillTriggering(skillName, description, tags = []) {
  const descriptionTokens = new Set(tokenizeForMatching(description));
  const prompts = buildTriggerPromptCandidates(skillName, tags);
  const results = prompts.map((prompt) => {
    const promptTokens = tokenizeForMatching(prompt);
    const matchedTokens = promptTokens.filter((token) => descriptionTokens.has(token));
    const matched = matchedTokens.length >= 2 || matchedTokens.includes(skillName.toLowerCase());
    return {
      prompt,
      matched,
      matchedTokens,
    };
  });

  const matchedCount = results.filter((result) => result.matched).length;
  const status =
    matchedCount === 0 ? "fail" : matchedCount < Math.ceil(results.length / 2) ? "warn" : "pass";

  return {
    status,
    matchedCount,
    promptCount: results.length,
    prompts: results,
    detail:
      status === "pass"
        ? `${matchedCount} of ${results.length} sample prompts match the current trigger wording.`
        : status === "warn"
          ? `Only ${matchedCount} of ${results.length} sample prompts match the current trigger wording.`
          : "The current trigger wording is too weak to match any of the sample prompts.",
  };
}

function validateSkill(skillName) {
  const normalized = normalizeSkillName(skillName);
  const files = listSkillFiles(normalized);
  const skill = loadSkill(normalized);
  const state = loadSkillState(normalized);
  const frontmatter = parseSkillFrontmatter(skill.skill);
  const body = extractSkillBody(skill.skill);
  const checks = [];

  checks.push({
    label: "Skill folder readability",
    status: files.length > 0 ? "pass" : "fail",
    detail: files.length > 0 ? "Skill files are present." : "No skill files were found.",
  });

  checks.push({
    label: "SKILL.md exists",
    status: files.some((file) => file.path === "SKILL.md") ? "pass" : "fail",
    detail: files.some((file) => file.path === "SKILL.md") ? "SKILL.md is present." : "SKILL.md is missing.",
  });

  checks.push({
    label: "Frontmatter includes name",
    status: frontmatter.name ? "pass" : "fail",
    detail: frontmatter.name ? `Frontmatter name is "${frontmatter.name}".` : "Frontmatter name is missing.",
  });

  checks.push({
    label: "Frontmatter includes description",
    status: frontmatter.description ? "pass" : "fail",
    detail: frontmatter.description ? "Description is present." : "Description is missing from frontmatter.",
  });

  checks.push({
    label: "Skill name matches folder",
    status: frontmatter.name === normalized ? "pass" : "fail",
    detail:
      frontmatter.name === normalized
        ? "Frontmatter name matches the folder name."
        : `Expected name "${normalized}" but found "${frontmatter.name || "(missing)"}".`,
  });

  checks.push({
    label: "Skill body has operating guidance",
    status: body.length >= 80 ? "pass" : body.length > 0 ? "warn" : "fail",
    detail:
      body.length >= 80
        ? "The body contains meaningful guidance."
        : body.length > 0
          ? "The body exists but is still very short."
          : "The SKILL.md body is empty.",
  });

  const references = skill.references;
  const inferredTags = inferSkillTags(normalized, frontmatter.description || "", references, state.tags);
  checks.push({
    label: "Reference support",
    status: references.length > 0 ? "pass" : "warn",
    detail:
      references.length > 0
        ? `${references.length} reference file(s) are available.`
        : "No reference files found.",
  });

  const unlinkedReferences = references.filter((reference) => !skill.skill.includes(reference.name));
  checks.push({
    label: "Reference routing from SKILL.md",
    status: unlinkedReferences.length === 0 ? "pass" : references.length === 0 ? "warn" : "warn",
    detail:
      references.length === 0
        ? "No references to route from SKILL.md."
        : unlinkedReferences.length === 0
          ? "All references are mentioned in SKILL.md."
          : `Some references are not explicitly mentioned: ${unlinkedReferences.map((ref) => ref.name).join(", ")}.`,
  });

  checks.push({
    label: "State metadata",
    status: state.tags.length > 0 || state.owner || state.qualityStatus !== "draft" ? "pass" : "warn",
    detail:
      state.tags.length > 0 || state.owner || state.qualityStatus !== "draft"
        ? "Skill metadata is present."
        : "No extra metadata recorded yet; tags/owner/status can improve discoverability.",
  });

  const triggerValidation = validateSkillTriggering(normalized, frontmatter.description, inferredTags);
  checks.push({
    label: "Prompt trigger coverage",
    status: triggerValidation.status,
    detail: triggerValidation.detail,
    prompts: triggerValidation.prompts,
  });

  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const status = failCount > 0 ? "failed" : warnCount > 0 ? "warning" : "passed";

  return {
    status,
    message:
      status === "failed"
        ? "One or more validation checks failed."
        : status === "warning"
          ? "Validation passed with warnings."
          : "Validation passed successfully.",
    triggerValidation,
    failCount,
    warnCount,
    checks,
  };
}

function getQaReportsDirectory(skillName) {
  return safeJoin(QA_REPORTS_ROOT, normalizeSkillName(skillName));
}

function formatQaReportFindings(validation) {
  return validation.checks
    .filter((check) => check.status === "fail" || check.status === "warn")
    .map((check) => {
      const severity = check.status === "fail" ? "High" : "Medium";
      return {
        severity,
        title: check.label,
        area: "Skill definition",
        expected: "The skill should satisfy the validation rule cleanly.",
        actual: check.detail,
        impact:
          check.status === "fail"
            ? "This weakens skill reliability and should be fixed before relying on the skill."
            : "This leaves residual quality risk and should be improved soon.",
      };
    });
}

function getQaReleaseRecommendation(validation) {
  if (validation.failCount > 0) {
    return "No-go";
  }
  if (validation.warnCount > 0) {
    return "Go with caution";
  }
  return "Go";
}

function generateSkillQaReport(skillName, validation) {
  const now = new Date();
  const createdAt = now.toISOString();
  const reportId = `${createdAt.replace(/[:.]/g, "-")}`;
  const findings = formatQaReportFindings(validation);
  const recommendation = getQaReleaseRecommendation(validation);
  const scope = [
    "SKILL.md structure",
    "frontmatter quality",
    "reference presence and routing",
    "skill metadata readiness",
  ];
  const monitoringWatchlist = [
    "missing or weak skill descriptions",
    "unlinked reference files",
    "skills with repeated warnings across edits",
    "skills marked ready without a recent validation pass",
  ];
  const remainingGaps =
    validation.warnCount > 0
      ? validation.checks.filter((check) => check.status === "warn").map((check) => check.label)
      : ["No open validation gaps from this run."];

  const lines = [
    `# QA Report - ${skillName}`,
    "",
    `Generated: ${createdAt}`,
    "",
    "## objective",
    "",
    `Validate the current state of the \`${skillName}\` skill after recent changes and record release confidence.`,
    "",
    "## scope",
    "",
    ...scope.map((item) => `- ${item}`),
    "",
    "## environment and assumptions",
    "",
    "- Validation executed from the conductor skill workflow.",
    "- This report covers skill-library quality checks, not runtime application penetration testing.",
    "",
    "## coverage summary",
    "",
    `- Overall status: ${validation.status}`,
    `- Checks run: ${validation.checks.length}`,
    `- Fails: ${validation.failCount}`,
    `- Warnings: ${validation.warnCount}`,
    "",
    "## findings by severity",
    "",
  ];

  if (findings.length === 0) {
    lines.push("- No findings from this validation run.");
  } else {
    for (const finding of findings) {
      lines.push(`[${finding.severity}] ${finding.title}`);
      lines.push(`Area: ${finding.area}`);
      lines.push("Steps: Run the conductor skill validation for this skill.");
      lines.push(`Expected: ${finding.expected}`);
      lines.push(`Actual: ${finding.actual}`);
      lines.push(`Impact: ${finding.impact}`);
      lines.push(`Evidence: validation rule output for "${finding.title}"`);
      lines.push("");
    }
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  lines.push("");
  lines.push("## release recommendation");
  lines.push("");
  lines.push(`- ${recommendation}`);
  lines.push("");
  lines.push("## monitoring watchlist");
  lines.push("");
  monitoringWatchlist.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("## remaining gaps");
  lines.push("");
  remainingGaps.forEach((item) => lines.push(`- ${item}`));
  lines.push("");

  return {
    id: reportId,
    createdAt,
    recommendation,
    findingsCount: findings.length,
    path: path.join(getQaReportsDirectory(skillName), `${reportId}.md`),
    content: lines.join("\n"),
  };
}

function saveSkillQaReport(skillName, validation) {
  const report = generateSkillQaReport(skillName, validation);
  fs.mkdirSync(path.dirname(report.path), { recursive: true });
  fs.writeFileSync(report.path, report.content, "utf-8");

  const state = loadSkillState(skillName);
  saveSkillState(skillName, {
    ...state,
    lastAuditedAt: report.createdAt,
    latestQaReport: {
      id: report.id,
      createdAt: report.createdAt,
      recommendation: report.recommendation,
      findingsCount: report.findingsCount,
      relativePath: path.relative(/* turbopackIgnore: true */ process.cwd(), report.path).replace(/\\/g, "/"),
    },
  });

  return {
    id: report.id,
    createdAt: report.createdAt,
    recommendation: report.recommendation,
    findingsCount: report.findingsCount,
    relativePath: path.relative(/* turbopackIgnore: true */ process.cwd(), report.path).replace(/\\/g, "/"),
    content: report.content,
  };
}

function loadLatestSkillQaReport(skillName) {
  const state = loadSkillState(skillName);
  if (!state.latestQaReport?.relativePath) {
    return null;
  }

  const reportPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), state.latestQaReport.relativePath);
  if (!fs.existsSync(reportPath)) {
    return {
      ...state.latestQaReport,
      content: "",
      missing: true,
    };
  }

  return {
    ...state.latestQaReport,
    content: fs.readFileSync(reportPath, "utf-8"),
    missing: false,
  };
}

function getSkillRecord(entryName) {
  const skillDir = path.join(SKILLS_ROOT, entryName);
  const skillMdPath = path.join(skillDir, "SKILL.md");
  const content = fs.existsSync(skillMdPath) ? fs.readFileSync(skillMdPath, "utf-8") : "";
  const frontmatter = parseSkillFrontmatter(content);
  const description = frontmatter.description || "No description";
  const files = listSkillFiles(entryName);
  const references = files.filter((file) => file.type === "reference");
  const state = loadSkillState(entryName);
  const validation = validateSkill(entryName);
  const tags = inferSkillTags(entryName, description, references, state.tags);
  const lastUpdatedAt = getSkillLastUpdatedAt(entryName, files);
  const freshness = getSkillFreshness({
    lastUpdatedAt,
    lastAuditedAt: state.lastAuditedAt || null,
  });
  const scorecard = calculateSkillScorecard({
    healthStatus: validation.status,
    qualityStatus: state.qualityStatus || "draft",
    owner: state.owner || "",
    reviewer: state.reviewer || "",
    referenceCount: references.length,
    freshnessStatus: freshness.status,
    triggerSummary: validation.triggerValidation,
    latestQaReport: state.latestQaReport || null,
  });

  return {
    name: entryName,
    description,
    importedTo: state.importedTo,
    importedAt: state.importedAt,
    tags,
    owner: state.owner || "",
    reviewer: state.reviewer || "",
    qualityStatus: state.qualityStatus || "draft",
    lastUpdatedAt,
    lastAuditedAt: state.lastAuditedAt || null,
    freshnessStatus: freshness.status,
    freshnessAgeDays: freshness.ageDays,
    scorecard,
    latestQaReport: state.latestQaReport || null,
    fileCount: files.length,
    referenceCount: references.length,
    healthStatus: validation.status,
    triggerSummary: validation.triggerValidation,
    validationSummary: {
      status: validation.status,
      failCount: validation.failCount,
      warnCount: validation.warnCount,
    },
  };
}

function listSkills(query = "", filter = "all", tag = "") {
  const safeQuery = sanitizeText(query, 100, "Search query");
  const safeFilter = ["all", "imported", "pending"].includes(filter) ? filter : "all";
  const safeTag = sanitizeText(tag, 40, "Tag").trim().toLowerCase();
  const entries = fs.existsSync(SKILLS_ROOT)
    ? fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })
    : [];
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => {
      try {
        return getSkillRecord(entry.name);
      } catch (error) {
        if (String(error?.message || "").includes("Skill not found")) {
          return null;
        }
        throw error;
      }
    })
    .filter(Boolean)
    .filter((skill) => {
      const term = safeQuery.trim().toLowerCase();
      const matchesSearch =
        !term ||
        skill.name.toLowerCase().includes(term) ||
        skill.description.toLowerCase().includes(term) ||
        skill.tags.some((item) => item.includes(term));
      if (!matchesSearch) return false;

      if (safeTag && !skill.tags.includes(safeTag)) {
        return false;
      }

      if (safeFilter === "imported") {
        return !!skill.importedTo;
      }
      if (safeFilter === "pending") {
        return !skill.importedTo;
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSkillInsights() {
  const skills = listSkills();
  const byTag = {};
  const byQualityStatus = {};
  const byHealthStatus = {};
  const byOwner = {};
  const byFreshnessStatus = {};
  const byScoreGrade = {};
  const byStability = {};

  for (const skill of skills) {
    byQualityStatus[skill.qualityStatus] = (byQualityStatus[skill.qualityStatus] || 0) + 1;
    byHealthStatus[skill.healthStatus] = (byHealthStatus[skill.healthStatus] || 0) + 1;
    const ownerKey = skill.owner || "unassigned";
    byOwner[ownerKey] = (byOwner[ownerKey] || 0) + 1;
    byFreshnessStatus[skill.freshnessStatus] = (byFreshnessStatus[skill.freshnessStatus] || 0) + 1;
    byScoreGrade[skill.scorecard.grade] = (byScoreGrade[skill.scorecard.grade] || 0) + 1;
    byStability[skill.scorecard.stability] = (byStability[skill.scorecard.stability] || 0) + 1;
    for (const tag of skill.tags) {
      byTag[tag] = (byTag[tag] || 0) + 1;
    }
  }

  return {
    totalSkills: skills.length,
    importedSkills: skills.filter((skill) => skill.importedTo).length,
    readySkills: skills.filter((skill) => skill.qualityStatus === "production-ready").length,
    ownedSkills: skills.filter((skill) => skill.owner).length,
    unownedSkills: skills.filter((skill) => !skill.owner).length,
    staleSkills: skills.filter((skill) => skill.freshnessStatus === "stale").length,
    stableSkills: skills.filter((skill) => skill.scorecard.stability === "stable").length,
    healthSummary: byHealthStatus,
    qualitySummary: byQualityStatus,
    freshnessSummary: byFreshnessStatus,
    scoreGradeSummary: byScoreGrade,
    stabilitySummary: byStability,
    tagSummary: Object.entries(byTag)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([tag, count]) => ({ tag, count })),
    ownerSummary: Object.entries(byOwner)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([owner, count]) => ({ owner, count })),
  };
}

function getSkillDirectory(skillName) {
  const normalized = normalizeSkillName(skillName);
  return safeJoin(SKILLS_ROOT, normalized);
}

function ensureSkillExists(skillName) {
  const skillDir = getSkillDirectory(skillName);
  if (!fs.existsSync(skillDir)) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  return skillDir;
}

async function createSkill(skillName, description, userId) {
  const normalized = normalizeSkillName(skillName);
  const safeDescription = sanitizeDescription(description);
  const skillDir = safeJoin(SKILLS_ROOT, normalized);
  if (fs.existsSync(skillDir)) {
    throw new Error(`A skill with this name already exists: ${normalized}`);
  }
  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  const content = `---\nname: ${normalized}\ndescription: ${safeDescription}\n---\n\n# ${normalized}\n\nDescribe this skill here.\n`;
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");
  await logSkillActivity({
    userId,
    action: "skill:create",
    resourceId: normalized,
    changes: {
      before: null,
      after: { skillName: normalized, description: safeDescription },
    },
    metadata: { skillName: normalized, source: "conductor-ui" },
  });
  return normalized;
}

function getImportedWorkspaceDirectory(importName) {
  const normalized = normalizeSkillName(importName);
  return safeJoin(IMPORT_ROOT, normalized);
}

function listImportedWorkspaces() {
  if (!fs.existsSync(IMPORT_ROOT)) {
    return [];
  }

  return fs.readdirSync(IMPORT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => {
      const contextPath = path.join(IMPORT_ROOT, entry.name, "CONTEXT.md");
      const stats = fs.existsSync(contextPath) ? fs.statSync(contextPath) : null;
      return {
        name: entry.name,
        hasContext: !!stats,
        contextUpdatedAt: stats?.mtime.toISOString() || null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function loadImportedWorkspaceContext(importName) {
  const workspaceDir = getImportedWorkspaceDirectory(importName);
  const contextPath = path.join(workspaceDir, "CONTEXT.md");
  if (!fs.existsSync(contextPath)) {
    ensureProjectContextFile(workspaceDir, normalizeSkillName(importName));
  }
  return fs.readFileSync(contextPath, "utf-8");
}

async function saveImportedWorkspaceContext(importName, content, userId) {
  const workspaceName = normalizeSkillName(importName);
  const workspaceDir = getImportedWorkspaceDirectory(workspaceName);
  const contextPath = path.join(workspaceDir, "CONTEXT.md");
  const previousContent = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, "utf-8") : "";
  const safeContent = assertSkillFileContent(content);

  fs.writeFileSync(contextPath, safeContent, "utf-8");

  await logContextActivity({
    userId,
    action: "context:update",
    resourceId: workspaceName,
    changes: {
      before: {
        hash: hashContent(previousContent),
        bytes: Buffer.byteLength(previousContent, "utf-8"),
      },
      after: {
        hash: hashContent(safeContent),
        bytes: Buffer.byteLength(safeContent, "utf-8"),
      },
    },
    metadata: {
      workspaceName,
      filePath: "CONTEXT.md",
      source: "conductor-ui",
      diffSummary: summarizeLineDiff(previousContent, safeContent),
    },
  });
}

function listSkillFiles(skillName) {
  const skillDir = ensureSkillExists(skillName);
  const files = [];
  const skillMdPath = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(skillMdPath)) {
    files.push({ path: "SKILL.md", name: "SKILL.md", type: "skill" });
  }
  const referencesDir = path.join(skillDir, "references");
  if (fs.existsSync(referencesDir)) {
    const entries = fs.readdirSync(referencesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ path: `references/${entry.name}`, name: entry.name, type: "reference" });
      }
    }
  }
  return files;
}

function loadSkill(skillName) {
  const skillDir = ensureSkillExists(skillName);
  const skillMdPath = path.join(skillDir, "SKILL.md");
  const referencesDir = path.join(skillDir, "references");
  const skillContent = fs.existsSync(skillMdPath) ? fs.readFileSync(skillMdPath, "utf-8") : "";
  const references = [];
  if (fs.existsSync(referencesDir)) {
    const entries = fs.readdirSync(referencesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        references.push({ name: entry.name, content: fs.readFileSync(path.join(referencesDir, entry.name), "utf-8") });
      }
    }
  }
  return { skill: skillContent, references };
}

function loadFile(skillName, relativePath) {
  const skillDir = ensureSkillExists(skillName);
  const editablePath = assertEditableSkillFile(relativePath);
  const file = safeJoin(skillDir, editablePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`File not found: ${editablePath}`);
  }
  return fs.readFileSync(file, "utf-8");
}

async function saveFile(skillName, relativePath, content, userId, options = {}) {
  const editablePath = assertEditableSkillFile(relativePath);
  const safeContent = assertSkillFileContent(content);
  const skillDir = ensureSkillExists(skillName);
  const file = safeJoin(skillDir, editablePath);
  const directory = path.dirname(file);
  const directoryRelative = path.relative(skillDir, directory);
  if (directoryRelative.startsWith("..") || path.isAbsolute(directoryRelative)) {
    throw new Error("Cannot write outside of the skill folder.");
  }
  const previousContent = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  await seedVersionHistoryIfNeeded(skillName, editablePath, previousContent);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(file, safeContent, "utf-8");
  const versionEntry = await recordSkillVersion({
    skillName,
    relativePath: editablePath,
    content: safeContent,
    userId,
    action: options.versionAction || "update",
    restoredFromVersionId: options.restoredFromVersionId || null,
  });
  await logSkillActivity({
    userId,
    action: options.activityAction || "skill:file:update",
    resourceId: `${normalizeSkillName(skillName)}:${editablePath}`,
    changes: {
      before: {
        hash: hashContent(previousContent),
        bytes: Buffer.byteLength(previousContent, "utf-8"),
      },
      after: {
        hash: hashContent(safeContent),
        bytes: Buffer.byteLength(safeContent, "utf-8"),
      },
    },
    metadata: {
      skillName: normalizeSkillName(skillName),
      filePath: editablePath,
      fileType: getFileType(editablePath),
      source: options.source || "conductor-ui",
      versionId: versionEntry.id,
      versionAction: versionEntry.action,
      restoredFromVersionId: versionEntry.restoredFromVersionId,
      diffSummary: summarizeLineDiff(previousContent, safeContent),
    },
  });
}

function listVersionedSkillFiles() {
  if (!fs.existsSync(VERSION_HISTORY_ROOT)) {
    return [];
  }

  const skillDirectories = fs.readdirSync(VERSION_HISTORY_ROOT, { withFileTypes: true });
  const versionedFiles = [];

  for (const skillDirectory of skillDirectories) {
    if (!skillDirectory.isDirectory()) {
      continue;
    }

    const skillName = skillDirectory.name;
    const directory = path.join(VERSION_HISTORY_ROOT, skillName);
    const files = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const encodedPath = entry.name.slice(0, -5);
      let filePath = "";

      try {
        filePath = assertEditableSkillFile(decodeVersionPath(encodedPath));
      } catch {
        continue;
      }

      const versions = readVersionHistory(skillName, filePath);
      if (versions.length === 0) {
        continue;
      }

      versionedFiles.push({
        skillName,
        filePath,
        fileType: getFileType(filePath),
        versionCount: versions.length,
        latestVersion: {
          id: versions[0].id,
          createdAt: versions[0].createdAt,
          action: versions[0].action,
          actor: versions[0].actor || null,
        },
      });
    }
  }

  return versionedFiles.sort((left, right) => {
    return new Date(right.latestVersion.createdAt).getTime() - new Date(left.latestVersion.createdAt).getTime();
  });
}

function listSkillVersions(skillName, relativePath, limit = 20) {
  return readVersionHistory(skillName, relativePath)
    .slice(0, limit)
    .map(({ content, ...version }) => ({
      ...version,
      preview: content.slice(0, 240),
    }));
}

function getSkillVersion(skillName, relativePath, versionId) {
  const safeSkillName = normalizeSkillName(skillName);
  const safePath = assertEditableSkillFile(relativePath);
  return readVersionHistory(safeSkillName, safePath).find((version) => version.id === versionId) || null;
}

function getSkillVersionComparison(skillName, relativePath, previousVersionId, nextVersionId) {
  const previousVersion = getSkillVersion(skillName, relativePath, previousVersionId);
  const nextVersion = getSkillVersion(skillName, relativePath, nextVersionId);

  if (!previousVersion || !nextVersion) {
    return null;
  }

  return {
    previousVersion,
    nextVersion,
    diffSummary: summarizeLineDiff(previousVersion.content, nextVersion.content),
  };
}

async function restoreSkillVersion(skillName, relativePath, versionId, userId) {
  const version = getSkillVersion(skillName, relativePath, versionId);
  if (!version) {
    throw new Error("Skill version not found.");
  }

  await saveFile(skillName, relativePath, version.content, userId, {
    source: "admin-dashboard",
    activityAction: "skill:file:restore",
    versionAction: "restore",
    restoredFromVersionId: version.id,
  });

  return version;
}

function ensureProjectContextFile(projectDir, projectName) {
  const contextPath = path.join(projectDir, "CONTEXT.md");
  if (fs.existsSync(contextPath)) {
    return contextPath;
  }

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const content = `# Project Context

> This file is maintained automatically for the imported project.
> Read it at the start of each work session and update it as work progresses.

## Project overview

${projectName} is an imported project folder in the skill orchestration workspace.

## Stack

- Skill orchestration workspace
- Prisma-backed persistence
- Next.js and Node.js tooling

## Current status

- Project imported and ready for review.

## Open questions / blockers

- None recorded yet.

## Decisions log

- Initial context scaffold created automatically.

## Changelog

### ${timestamp}

Initial context scaffold created for this project.
`;

  fs.writeFileSync(contextPath, content, "utf-8");
  return contextPath;
}

async function logSkillActivity({ userId, action, resourceId, changes, metadata }) {
  try {
    if (!userId) {
      throw new Error("Authenticated user id is required for skill activity logging.");
    }

    const db = skillStorageTestHooks.db ?? (await import("./db")).db;
    const logAction = skillStorageTestHooks.logAction ?? (await import("../features/logging/server-functions")).logAction;

    await db.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@local.conductor`,
      },
    });

    await logAction({
      userId,
      action,
      resource: "skill",
      resourceId,
      changes,
      metadata,
    });
  } catch (error) {
    console.error("Failed to log skill activity:", error);
  }
}

async function logContextActivity({ userId, action, resourceId, changes, metadata }) {
  try {
    if (!userId) {
      throw new Error("Authenticated user id is required for context activity logging.");
    }

    const db = skillStorageTestHooks.db ?? (await import("./db")).db;
    const logAction = skillStorageTestHooks.logAction ?? (await import("../features/logging/server-functions")).logAction;

    await db.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@local.conductor`,
      },
    });

    await logAction({
      userId,
      action,
      resource: "context",
      resourceId,
      changes,
      metadata,
    });
  } catch (error) {
    console.error("Failed to log context activity:", error);
  }
}

function __setSkillStorageTestHooks(hooks = {}) {
  skillStorageTestHooks.db = hooks.db ?? null;
  skillStorageTestHooks.logAction = hooks.logAction ?? null;
}

async function importSkill(skillName, importName, userId) {
  const skillDir = ensureSkillExists(skillName);
  const destinationName = normalizeSkillName(importName || skillName);
  const targetDir = safeJoin(IMPORT_ROOT, destinationName);
  if (fs.existsSync(targetDir)) {
    throw new Error(`Import destination already exists: ${destinationName}`);
  }
  fs.mkdirSync(IMPORT_ROOT, { recursive: true });
  fs.cpSync(skillDir, targetDir, { recursive: true });
  ensureProjectContextFile(targetDir, destinationName);
  saveSkillState(skillName, {
    importedTo: destinationName,
    importedAt: new Date().toISOString(),
  });
  await logSkillActivity({
    userId,
    action: "skill:import",
    resourceId: destinationName,
    changes: {
      before: { sourceSkillName: normalizeSkillName(skillName) },
      after: { importedTo: destinationName },
    },
    metadata: {
      skillName: normalizeSkillName(skillName),
      importedTo: destinationName,
      source: "conductor-ui",
    },
  });
  return destinationName;
}

export {
  listSkills,
  getSkillRecord,
  validateSkill,
  saveSkillQaReport,
  loadLatestSkillQaReport,
  getSkillInsights,
  parseSkillFrontmatter,
  createSkill,
  getSkillDirectory,
  listSkillFiles,
  loadSkill,
  loadFile,
  saveFile,
  importSkill,
  loadSkillState,
  logSkillActivity,
  listImportedWorkspaces,
  loadImportedWorkspaceContext,
  saveImportedWorkspaceContext,
  listVersionedSkillFiles,
  listSkillVersions,
  getSkillVersion,
  getSkillVersionComparison,
  restoreSkillVersion,
  __setSkillStorageTestHooks,
};
