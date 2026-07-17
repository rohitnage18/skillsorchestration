import { errorResponse, jsonResponse } from "../../../../../../lib/http";
import { executeSkillSchema } from "../../../../../../features/skills/schemas";
import { executeRegistrySkill, getOwnerId } from "../../../../../../features/skills/service";
import { getErrorStatus, requirePermission } from "../../../../../../lib/auth.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../../lib/requestSecurity.js";

type RouteContext = {
  params: Promise<{ skillId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    const user = await requirePermission(req.headers, "skills:use");
    enforceRateLimit({
      bucket: "registry-skill-execute",
      key: buildRateLimitKey(req.headers, "registry-skill-execute", user.id),
      limit: 40,
      windowMs: 60_000,
    });
    const { input } = executeSkillSchema.parse(await req.json());

    return jsonResponse(await executeRegistrySkill(await getOwnerId(req.headers), skillId, input));
  } catch (error) {
    return errorResponse(error, "Unable to execute registry skill.", getErrorStatus(error, 400));
  }
}
