import { errorResponse, jsonResponse } from "../../../../lib/http";
import { createSkillSchema } from "../../../../features/skills/schemas";
import { createRegistrySkill, getOwnerId, listRegistrySkills } from "../../../../features/skills/service";
import { getErrorStatus, requireAdmin } from "../../../../lib/auth.js";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ownerId = await getOwnerId(req.headers);
    const query = url.searchParams.get("q") ?? "";

    return jsonResponse(await listRegistrySkills(ownerId, query));
  } catch (error) {
    return errorResponse(error, "Unable to list registry skills.");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin(req.headers);
    const input = createSkillSchema.parse(await req.json());

    return jsonResponse(await createRegistrySkill(user.id, input), 201);
  } catch (error) {
    return errorResponse(error, "Unable to create registry skill.", getErrorStatus(error, 400));
  }
}
