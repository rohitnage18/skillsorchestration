import { listSkillFiles } from "../../../../../lib/skillStorage.js";
import { normalizeSkillNameInput } from "../../../../../lib/inputSafety.js";
import { errorResponse, getRouteErrorStatus } from "../../../../../lib/http.ts";
import { requirePermission } from "../../../../../lib/auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req, { params }) {
  try {
    await requirePermission(req.headers, "skills:use");
    const { skillName } = await params;
    return json(listSkillFiles(normalizeSkillNameInput(skillName)));
  } catch (error) {
    return errorResponse(error, "Unable to list files.", getRouteErrorStatus(error));
  }
}
