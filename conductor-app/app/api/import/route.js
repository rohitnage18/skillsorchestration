import { importSkill } from "../../../lib/skillStorage.js";
import { getErrorStatus, requireAdmin } from "../../../lib/auth.js";
import { normalizeSkillNameInput } from "../../../lib/inputSafety.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const user = await requireAdmin(req.headers);
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
