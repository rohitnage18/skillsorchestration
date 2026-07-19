import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import {
  getSkillInsights,
  listImportedWorkspaces,
  listSkills,
  loadImportedWorkspaceContext,
  loadSkill,
} from "./skillStorage.js";

const RELEASE_SNAPSHOTS_ROOT = path.join(process.cwd(), "data", "release-snapshots");
const IMPORT_ROOT = path.join(process.cwd(), "imported-workspaces");
const REPO_ROOT = path.resolve(process.cwd(), "..");

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function tokenize(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s/-]+/g, " ")
      .split(/[\s/:-]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
  );
}

function overlapScore(leftValues, rightValues) {
  const left = Array.from(leftValues || []);
  const right = Array.from(rightValues || []);
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  const shared = left.filter((value) => rightSet.has(value));
  return shared.length / Math.max(left.length, right.length);
}

function toPercent(value) {
  return Math.round(Number(value || 0) * 100);
}

function listWorkspaceFiles(workspaceDir) {
  const files = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) {
      return;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const stats = fs.statSync(fullPath);
      files.push({
        name: path.relative(workspaceDir, fullPath).replace(/\\/g, "/"),
        updatedAt: stats.mtime.toISOString(),
        bytes: stats.size,
      });
    }
  }

  walk(workspaceDir);
  return files.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function gitExec(args) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function parseAheadBehind(value) {
  const [behindText = "0", aheadText = "0"] = String(value || "0\t0").split(/\s+/);
  return {
    behind: Number(behindText) || 0,
    ahead: Number(aheadText) || 0,
  };
}

function classifyWorkspaceRisk(signals) {
  if (signals.some((signal) => signal.severity === "high")) {
    return "high";
  }
  if (signals.some((signal) => signal.severity === "medium")) {
    return "medium";
  }
  return "low";
}

function skillProfile(skill) {
  const loaded = loadSkill(skill.name);
  const referenceNames = loaded.references.map((reference) => reference.name.replace(/\.md$/i, "").toLowerCase());
  const keywords = tokenize(
    [skill.name, skill.description, skill.owner, skill.reviewer, skill.tags.join(" "), loaded.skill]
      .filter(Boolean)
      .join(" ")
  );

  return {
    ...skill,
    keywords,
    referenceNames,
    loaded,
  };
}

export function getSkillDependencyGraph(limit = 20) {
  const profiles = listSkills().map(skillProfile);
  const edges = [];
  const edgeCounts = new Map();

  for (let index = 0; index < profiles.length; index += 1) {
    for (let innerIndex = index + 1; innerIndex < profiles.length; innerIndex += 1) {
      const left = profiles[index];
      const right = profiles[innerIndex];
      const tagOverlap = overlapScore(left.tags, right.tags);
      const referenceOverlap = overlapScore(left.referenceNames, right.referenceNames);
      const keywordOverlap = overlapScore(left.keywords, right.keywords);
      const nameOverlap = overlapScore(tokenize(left.name), tokenize(right.name));
      const similarityScore = Number(
        (tagOverlap * 0.35 + referenceOverlap * 0.25 + keywordOverlap * 0.25 + nameOverlap * 0.15).toFixed(2)
      );
      const weightedScore = tagOverlap * 0.25 + referenceOverlap * 0.25 + keywordOverlap * 0.2 + similarityScore * 0.3;

      if (weightedScore < 0.22) {
        continue;
      }

      const reasons = [];
      if (tagOverlap >= 0.25) reasons.push(`${toPercent(tagOverlap)}% shared tags`);
      if (referenceOverlap >= 0.25) reasons.push(`${toPercent(referenceOverlap)}% shared references`);
      if (keywordOverlap >= 0.3) reasons.push(`${toPercent(keywordOverlap)}% keyword overlap`);
      if (similarityScore >= 0.35) reasons.push(`${toPercent(similarityScore)}% authoring similarity`);

      const relationship =
        weightedScore >= 0.58 ? "overlapping" : referenceOverlap >= 0.35 ? "reused" : "related";

      edges.push({
        source: left.name,
        target: right.name,
        score: Number(weightedScore.toFixed(2)),
        relationship,
        reasons,
      });

      edgeCounts.set(left.name, (edgeCounts.get(left.name) || 0) + 1);
      edgeCounts.set(right.name, (edgeCounts.get(right.name) || 0) + 1);
    }
  }

  const sortedEdges = edges.sort(
    (left, right) => right.score - left.score || left.source.localeCompare(right.source) || left.target.localeCompare(right.target)
  );

  return {
    generatedAt: new Date().toISOString(),
    nodeCount: profiles.length,
    edgeCount: sortedEdges.length,
    nodes: profiles.map((skill) => ({
      id: skill.name,
      label: skill.name,
      qualityStatus: skill.qualityStatus,
      healthStatus: skill.healthStatus,
      stability: skill.scorecard?.stability || "watch",
      overlapCount: edgeCounts.get(skill.name) || 0,
      tags: skill.tags,
      importedTo: skill.importedTo || null,
    })),
    topEdges: sortedEdges.slice(0, limit),
    mostConnectedSkills: profiles
      .map((skill) => ({
        skillName: skill.name,
        overlapCount: edgeCounts.get(skill.name) || 0,
        healthStatus: skill.healthStatus,
        qualityStatus: skill.qualityStatus,
      }))
      .filter((item) => item.overlapCount > 0)
      .sort((left, right) => right.overlapCount - left.overlapCount || left.skillName.localeCompare(right.skillName))
      .slice(0, 8),
  };
}

export function getImportedWorkspaceIntelligence(limit = 8) {
  const workspaces = listImportedWorkspaces();
  const skills = listSkills();

  const details = workspaces.map((workspace) => {
    const workspaceDir = path.join(IMPORT_ROOT, workspace.name);
    const context = workspace.hasContext ? loadImportedWorkspaceContext(workspace.name) : "";
    const contextTokens = tokenize(`${workspace.name} ${context}`);
    const linkedSkills = skills.filter((skill) => skill.importedTo === workspace.name);
    const freshnessDays = workspace.contextUpdatedAt
      ? Math.floor((Date.now() - new Date(workspace.contextUpdatedAt).getTime()) / 86_400_000)
      : null;
    const recentFiles = listWorkspaceFiles(workspaceDir).slice(0, 5);
    const riskSignals = [];

    if (!workspace.hasContext) {
      riskSignals.push({ severity: "high", label: "Missing CONTEXT.md" });
    }
    if (freshnessDays !== null && freshnessDays > 30) {
      riskSignals.push({ severity: freshnessDays > 90 ? "high" : "medium", label: `Context is ${freshnessDays} days old` });
    }
    if (linkedSkills.some((skill) => skill.healthStatus !== "passed")) {
      riskSignals.push({ severity: "medium", label: "Linked skills include health warnings" });
    }
    if (linkedSkills.some((skill) => skill.qualityStatus === "draft")) {
      riskSignals.push({ severity: "medium", label: "Linked skills still in draft quality state" });
    }

    const recommendedSkills = skills
      .filter((skill) => !linkedSkills.some((linked) => linked.name === skill.name))
      .map((skill) => {
        const tokens = tokenize(`${skill.name} ${skill.description} ${skill.tags.join(" ")}`);
        const score = overlapScore(contextTokens, tokens);
        return {
          skillName: skill.name,
          score: Number(score.toFixed(2)),
          reason: score >= 0.2 ? "Keyword overlap with workspace context" : "General library match",
          qualityStatus: skill.qualityStatus,
        };
      })
      .filter((item) => item.score >= 0.12)
      .sort((left, right) => right.score - left.score || left.skillName.localeCompare(right.skillName))
      .slice(0, 3);

    return {
      name: workspace.name,
      freshnessDays,
      riskLevel: classifyWorkspaceRisk(riskSignals),
      riskSignals,
      linkedSkills: linkedSkills.map((skill) => ({
        skillName: skill.name,
        healthStatus: skill.healthStatus,
        qualityStatus: skill.qualityStatus,
      })),
      recommendedSkills,
      recentActivity: recentFiles,
      contextPreview: context.slice(0, 240),
    };
  });

  const highRisk = details.filter((workspace) => workspace.riskLevel === "high").length;
  const mediumRisk = details.filter((workspace) => workspace.riskLevel === "medium").length;

  return {
    generatedAt: new Date().toISOString(),
    totalWorkspaces: details.length,
    highRisk,
    mediumRisk,
    lowRisk: details.length - highRisk - mediumRisk,
    workspaces: details
      .sort((left, right) => {
        const riskRank = { high: 0, medium: 1, low: 2 };
        return (
          riskRank[left.riskLevel] - riskRank[right.riskLevel] ||
          (right.freshnessDays ?? -1) - (left.freshnessDays ?? -1) ||
          left.name.localeCompare(right.name)
        );
      })
      .slice(0, limit),
  };
}

export function getRepositoryBranchHealth() {
  const branch = gitExec(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
  const remote = gitExec(["remote", "get-url", "origin"]) || "";
  const upstream = gitExec(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]) || "";
  const aheadBehind = parseAheadBehind(gitExec(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]));
  const statusLines = gitExec(["status", "--short"]).split(/\r?\n/).filter(Boolean);
  const commit = gitExec(["rev-parse", "--short", "HEAD"]) || "";
  const workflowRoot = path.join(REPO_ROOT, ".github", "workflows");
  const workflowFiles = fs.existsSync(workflowRoot)
    ? fs.readdirSync(workflowRoot).filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    : [];

  const branchProtected = branch === "main";
  const dirty = statusLines.length > 0;
  const mergeReadinessIssues = [];
  if (dirty) mergeReadinessIssues.push("Working tree has uncommitted changes");
  if (aheadBehind.behind > 0) mergeReadinessIssues.push(`Branch is behind upstream by ${aheadBehind.behind} commit(s)`);
  if (workflowFiles.length === 0) mergeReadinessIssues.push("No GitHub workflows detected");
  if (branch === "main") mergeReadinessIssues.push("Direct work should happen on a personal branch, not main");

  return {
    generatedAt: new Date().toISOString(),
    integrationMode: "local-repository",
    branch,
    commit,
    remote,
    upstream,
    dirty,
    ahead: aheadBehind.ahead,
    behind: aheadBehind.behind,
    changedFiles: statusLines,
    workflowFiles,
    branchPolicy: {
      directPushToMainBlocked: branchProtected || workflowFiles.length > 0,
      personalBranchExpected: true,
      manualPrToMainExpected: true,
    },
    mergeReadiness: {
      ready: mergeReadinessIssues.length === 0,
      issues: mergeReadinessIssues,
    },
  };
}

export function listReleaseSnapshots(limit = 20) {
  if (!fs.existsSync(RELEASE_SNAPSHOTS_ROOT)) {
    return [];
  }

  return fs.readdirSync(RELEASE_SNAPSHOTS_ROOT)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => safeReadJson(path.join(RELEASE_SNAPSHOTS_ROOT, entry), null))
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

export function createReleaseSnapshot(label = "") {
  fs.mkdirSync(RELEASE_SNAPSHOTS_ROOT, { recursive: true });
  const repo = getRepositoryBranchHealth();
  const insights = getSkillInsights();
  const dependencyGraph = getSkillDependencyGraph(10);
  const snapshot = {
    id: `${new Date().toISOString().slice(0, 10)}-${repo.commit || "local"}-${Math.random().toString(36).slice(2, 8)}`,
    label: String(label || "Stable snapshot").trim(),
    createdAt: new Date().toISOString(),
    repository: repo,
    skills: {
      total: insights.totalSkills,
      ready: insights.readySkills,
      stable: insights.stableSkills,
      stale: insights.staleSkills,
      failedHealth: insights.healthSummary.failed || 0,
      warningHealth: insights.healthSummary.warning || 0,
    },
    dependencyGraph: {
      nodeCount: dependencyGraph.nodeCount,
      edgeCount: dependencyGraph.edgeCount,
      mostConnectedSkills: dependencyGraph.mostConnectedSkills.slice(0, 5),
    },
  };
  fs.writeFileSync(path.join(RELEASE_SNAPSHOTS_ROOT, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2), "utf-8");
  return snapshot;
}

export function seedDemoWorkspaceData() {
  fs.mkdirSync(IMPORT_ROOT, { recursive: true });
  const workspaces = [
    {
      name: "demo-commerce-suite",
      content: `# Project Context

## Project overview

Customer storefront, checkout operations, and order support workspace for demo mode.

## Current status

- Checkout review flow needs approval verification.
- Frontend polish and regression testing are active.
- GitHub merge readiness should be checked before release.

## Risks

- Duplicate frontend skill creation should be prevented.
- Approval delay could block release.
`,
    },
    {
      name: "demo-ai-platform",
      content: `# Project Context

## Project overview

Internal AI orchestration environment for evaluation, prompt testing, and delivery safety.

## Current status

- Model release validation is in progress.
- Monitoring, rollback guidance, and test automation are required.

## Risks

- Validation drift between updates.
- Missing release snapshot before handoff.
`,
    },
  ];

  const created = [];
  for (const workspace of workspaces) {
    const workspaceDir = path.join(IMPORT_ROOT, workspace.name);
    const contextPath = path.join(workspaceDir, "CONTEXT.md");
    if (!fs.existsSync(contextPath)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(contextPath, workspace.content, "utf-8");
      created.push(workspace.name);
    }
  }

  const snapshot = createReleaseSnapshot("Demo mode baseline");
  return {
    createdWorkspaces: created,
    snapshotId: snapshot.id,
  };
}
