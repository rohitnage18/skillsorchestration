import { errorResponse, jsonResponse } from "../../../../lib/http";
import { createSkillSchema } from "../../../../features/skills/schemas";
import { createRegistrySkill, getOwnerId, listRegistrySkills } from "../../../../features/skills/service";
import { getErrorStatus, requirePermission } from "../../../../lib/auth.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../lib/requestSecurity.js";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ownerId = await getOwnerId(req.headers);
    const query = url.searchParams.get("q") ?? "";

    return jsonResponse(await listRegistrySkills(ownerId, query));
  } catch (error) {
    return errorResponse(error, "Unable to list registry skills.", getErrorStatus(error));
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission(req.headers, "registry_skills:manage");
    enforceRateLimit({
      bucket: "registry-skill-create",
      key: buildRateLimitKey(req.headers, "registry-skill-create", user.id),
      limit: 15,
      windowMs: 60_000,
    });
    const input = createSkillSchema.parse(await req.json());

    return jsonResponse(await createRegistrySkill(user.id, input), 201);
  } catch (error) {
    return errorResponse(error, "Unable to create registry skill.", getErrorStatus(error, 400));
  }
}
