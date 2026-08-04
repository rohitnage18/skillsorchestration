import { importSkill, installSkillForClient } from "../../../lib/skillStorage.js";
import { requirePermission } from "../../../lib/auth.js";
import { normalizeSkillNameInput } from "../../../lib/inputSafety.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../lib/requestSecurity.js";
import { errorResponse, getRouteErrorStatus } from "../../../lib/http.ts";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const user = await requirePermission(req.headers, "imports:manage");
    await enforceRateLimit({
      bucket: "skill-import",
      key: buildRateLimitKey(req.headers, "skill-import", user.id),
      limit: 12,
      windowMs: 60_000,
    });
    const body = await req.json();
    const skillName = normalizeSkillNameInput(body.skillName);
    const client = String(body.client ?? "workspace");
    if (!["workspace", "codex", "claude-code"].includes(client)) {
      return json({ error: "Import client must be workspace, codex, or claude-code." }, 400);
    }

    if (client === "workspace") {
      const targetName = normalizeSkillNameInput(body.targetName);
      const destination = await importSkill(skillName, targetName, user.id);
      return json({
        client,
        path: destination,
        message: `Skill "${skillName}" imported into Conductor workspace "${destination}".`,
      });
    }

    const result = await installSkillForClient(skillName, client, user.id);
    return json(result);
  } catch (error) {
    return errorResponse(error, "Unable to import skill.", getRouteErrorStatus(error));
  }
}
