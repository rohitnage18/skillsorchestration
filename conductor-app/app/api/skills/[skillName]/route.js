import { loadSkill } from "../../../../lib/skillStorage.js";
import { getRequestUser } from "../../../../lib/auth.js";
import { logAction } from "../../../../features/logging/server-functions";
import { normalizeSkillNameInput } from "../../../../lib/inputSafety.js";

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
    const skill = loadSkill(safeSkillName);

    if (process.env.ENABLE_SKILL_PREVIEW_TRACKING === "true") {
      const user = await getRequestUser(req.headers);
      if (user?.status === "ACTIVE") {
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
    }

    return json(skill);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load skill";
    return json({ error: message }, 404);
  }
}
