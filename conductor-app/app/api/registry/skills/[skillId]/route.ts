import { errorResponse, jsonResponse } from "../../../../../lib/http";
import { updateSkillSchema } from "../../../../../features/skills/schemas";
import {
  deleteRegistrySkill,
  getOwnerId,
  getRegistrySkill,
  updateRegistrySkill,
} from "../../../../../features/skills/service";

type RouteContext = {
  params: Promise<{ skillId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    return jsonResponse(await getRegistrySkill(getOwnerId(req.headers), skillId));
  } catch (error) {
    return errorResponse(error, "Unable to load registry skill.", 404);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    const input = updateSkillSchema.parse(await req.json());
    return jsonResponse(await updateRegistrySkill(getOwnerId(req.headers), skillId, input));
  } catch (error) {
    return errorResponse(error, "Unable to update registry skill.", 400);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    return jsonResponse(await deleteRegistrySkill(getOwnerId(req.headers), skillId));
  } catch (error) {
    return errorResponse(error, "Unable to delete registry skill.", 400);
  }
}
