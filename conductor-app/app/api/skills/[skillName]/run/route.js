import { logSkillActivity, saveSkillQaReport, validateSkill } from "../../../../../lib/skillStorage.js";
import { getErrorStatus, requirePermission } from "../../../../../lib/auth.js";
import { normalizeSkillNameInput } from "../../../../../lib/inputSafety.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../lib/requestSecurity.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req, { params }) {
  let user = null;
  let safeSkillName = "";
  try {
    const { skillName } = await params;
    safeSkillName = normalizeSkillNameInput(skillName);
    user = await requirePermission(req.headers, "skills:use");
    enforceRateLimit({
      bucket: "skill-validation-run",
      key: buildRateLimitKey(req.headers, "skill-validation-run", user.id),
      limit: 25,
      windowMs: 60_000,
    });
    const validation = validateSkill(safeSkillName);
    const qaReport = saveSkillQaReport(safeSkillName, validation);
    const result = {
      ...validation,
      status: validation.status === "failed" ? "failed" : "passed",
      qaReport: {
        id: qaReport.id,
        createdAt: qaReport.createdAt,
        recommendation: qaReport.recommendation,
        findingsCount: qaReport.findingsCount,
        relativePath: qaReport.relativePath,
        content: qaReport.content,
      },
      checks: validation.checks.map((check) => ({
        ...check,
        status: check.status === "warning" ? "warn" : check.status,
      })),
    };
    await logSkillActivity({
      userId: user.id,
      action: "skill:test",
      resourceId: safeSkillName,
      metadata: {
        skillName: safeSkillName,
        status: validation.status,
        failCount: validation.failCount,
        warnCount: validation.warnCount,
        qaReportId: qaReport.id,
        source: "conductor-ui",
      },
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run skill test";
    if (user?.id && safeSkillName) {
      await logSkillActivity({
        userId: user.id,
        action: "skill:test:fail",
        resourceId: safeSkillName,
        metadata: {
          skillName: safeSkillName,
          error: message,
          source: "conductor-ui",
        },
      });
    }
    return json({ error: message }, getErrorStatus(error, 500));
  }
}
