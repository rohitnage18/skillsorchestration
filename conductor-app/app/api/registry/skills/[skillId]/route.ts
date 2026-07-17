import { errorResponse, jsonResponse } from "../../../../../lib/http";
import { updateSkillSchema } from "../../../../../features/skills/schemas";
import {
  deleteRegistrySkill,
  getOwnerId,
  getRegistrySkill,
  updateRegistrySkill,
} from "../../../../../features/skills/service";
import { getErrorStatus, requirePermission } from "../../../../../lib/auth.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../lib/requestSecurity.js";

type RouteContext = {
  params: Promise<{ skillId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    return jsonResponse(await getRegistrySkill(await getOwnerId(req.headers), skillId));
  } catch (error) {
    return errorResponse(error, "Unable to load registry skill.", getErrorStatus(error, 404));
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    const user = await requirePermission(req.headers, "registry_skills:manage");
    enforceRateLimit({
      bucket: "registry-skill-update",
      key: buildRateLimitKey(req.headers, "registry-skill-update", user.id),
      limit: 30,
      windowMs: 60_000,
    });
    const input = updateSkillSchema.parse(await req.json());
    return jsonResponse(await updateRegistrySkill(user.id, skillId, input));
  } catch (error) {
    return errorResponse(error, "Unable to update registry skill.", getErrorStatus(error, 400));
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    const user = await requirePermission(req.headers, "registry_skills:manage");
    enforceRateLimit({
      bucket: "registry-skill-delete",
      key: buildRateLimitKey(req.headers, "registry-skill-delete", user.id),
      limit: 10,
      windowMs: 60_000,
    });
    return jsonResponse(await deleteRegistrySkill(user.id, skillId));
  } catch (error) {
    return errorResponse(error, "Unable to delete registry skill.", getErrorStatus(error, 400));
  }
}
