import { loadSkill } from "../../../../lib/skillStorage.js";
import { requirePermission } from "../../../../lib/auth.js";
import { logAction } from "../../../../features/logging/server-functions";
import { normalizeSkillNameInput } from "../../../../lib/inputSafety.js";
import { errorResponse, getRouteErrorStatus } from "../../../../lib/http.ts";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req, { params }) {
  try {
    const user = await requirePermission(req.headers, "skills:use");
    const { skillName } = await params;
    const safeSkillName = normalizeSkillNameInput(skillName);
    const skill = loadSkill(safeSkillName);

    if (process.env.ENABLE_SKILL_PREVIEW_TRACKING === "true") {
      await logAction({
        userId: user.id,
        action: "skill:preview",
        resource: "skill",
        resourceId: safeSkillName,
        metadata: {
          skillName: safeSkillName,
          source: "conductor-ui",
        },
      });
    }

    return json(skill);
  } catch (error) {
    return errorResponse(error, "Unable to load skill.", getRouteErrorStatus(error));
  }
}
