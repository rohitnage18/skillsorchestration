import { importSkill } from "../../../lib/skillStorage.js";
import { getErrorStatus, requirePermission } from "../../../lib/auth.js";
import { normalizeSkillNameInput } from "../../../lib/inputSafety.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../lib/requestSecurity.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const user = await requirePermission(req.headers, "imports:manage");
    enforceRateLimit({
      bucket: "skill-import",
      key: buildRateLimitKey(req.headers, "skill-import", user.id),
      limit: 12,
      windowMs: 60_000,
    });
    const body = await req.json();
    const skillName = normalizeSkillNameInput(body.skillName);
    const targetName = normalizeSkillNameInput(body.targetName);

    const destination = await importSkill(skillName, targetName, user.id);
    return json({ path: destination });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import skill";
    return json({ error: message }, getErrorStatus(error, 400));
  }
}
