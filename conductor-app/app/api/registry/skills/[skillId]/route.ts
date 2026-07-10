import { errorResponse, jsonResponse } from "../../../../../lib/http";
import { updateSkillSchema } from "../../../../../features/skills/schemas";
import {
  deleteRegistrySkill,
  getOwnerId,
  getRegistrySkill,
  updateRegistrySkill,
} from "../../../../../features/skills/service";
import { getErrorStatus, requireAdmin } from "../../../../../lib/auth.js";

type RouteContext = {
  params: Promise<{ skillId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    return jsonResponse(await getRegistrySkill(await getOwnerId(req.headers), skillId));
  } catch (error) {
    return errorResponse(error, "Unable to load registry skill.", 404);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    const user = await requireAdmin(req.headers);
    const input = updateSkillSchema.parse(await req.json());
    return jsonResponse(await updateRegistrySkill(user.id, skillId, input));
  } catch (error) {
    return errorResponse(error, "Unable to update registry skill.", getErrorStatus(error, 400));
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    const user = await requireAdmin(req.headers);
    return jsonResponse(await deleteRegistrySkill(user.id, skillId));
  } catch (error) {
    return errorResponse(error, "Unable to delete registry skill.", getErrorStatus(error, 400));
  }
}
