import { getSkillRecord, listSkillFiles, loadLatestSkillQaReport, loadSkill, loadSkillState, parseSkillFrontmatter, validateSkill } from "../../../../../lib/skillStorage.js";
import { normalizeSkillNameInput } from "../../../../../lib/inputSafety.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req, { params }) {
  try {
    const { skillName } = await params;
    const safeSkillName = normalizeSkillNameInput(skillName);
    const files = listSkillFiles(safeSkillName);
    const skill = loadSkill(safeSkillName);
    const state = loadSkillState(safeSkillName);
    const record = getSkillRecord(safeSkillName);
    const frontmatter = parseSkillFrontmatter(skill.skill);
    const validation = validateSkill(safeSkillName);
    const latestQaReport = loadLatestSkillQaReport(safeSkillName);
    const fileCount = files.length;
    const referenceCount = files.filter((file) => file.type === "reference").length;
    const hasSkillFile = files.some((file) => file.path === "SKILL.md");
    return json({
      fileCount,
      referenceCount,
      hasSkillFile,
      importedTo: state.importedTo,
      importedAt: state.importedAt,
      tags: record.tags,
      owner: state.owner,
      reviewer: state.reviewer,
      qualityStatus: state.qualityStatus,
      freshnessStatus: record.freshnessStatus,
      freshnessAgeDays: record.freshnessAgeDays,
      scorecard: record.scorecard,
      lastAuditedAt: state.lastAuditedAt,
      latestQaReport: latestQaReport
        ? {
            id: latestQaReport.id,
            createdAt: latestQaReport.createdAt,
            recommendation: latestQaReport.recommendation,
            findingsCount: latestQaReport.findingsCount,
            relativePath: latestQaReport.relativePath,
          }
        : null,
      lastUpdated: record.lastUpdatedAt,
      triggerSummary: validation.triggerValidation,
      validationSummary: {
        status: validation.status,
        failCount: validation.failCount,
        warnCount: validation.warnCount,
      },
      skillInfo: {
        name: safeSkillName,
        description: frontmatter.description || "No description",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load skill summary";
    return json({ error: message }, 404);
  }
}
