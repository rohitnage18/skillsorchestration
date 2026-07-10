import { errorResponse, jsonResponse } from "../../../../../../lib/http";
import { executeSkillSchema } from "../../../../../../features/skills/schemas";
import { executeRegistrySkill, getOwnerId } from "../../../../../../features/skills/service";

type RouteContext = {
  params: Promise<{ skillId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const { skillId } = await context.params;
    const { input } = executeSkillSchema.parse(await req.json());

    return jsonResponse(await executeRegistrySkill(await getOwnerId(req.headers), skillId, input));
  } catch (error) {
    return errorResponse(error, "Unable to execute registry skill.", 400);
  }
}
