import { errorResponse, jsonResponse } from "../../../lib/http";
import { createWorkflowSchema } from "../../../features/workflows/schemas";
import { createWorkflow, getOwnerId, listWorkflows } from "../../../features/workflows/service";
import { getErrorStatus, requirePermission } from "../../../lib/auth.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../lib/requestSecurity.js";

export async function GET(req: Request) {
  try {
    return jsonResponse(await listWorkflows(await getOwnerId(req.headers)));
  } catch (error) {
    return errorResponse(error, "Unable to list workflows.", getErrorStatus(error));
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission(req.headers, "workflows:manage");
    enforceRateLimit({
      bucket: "workflow-create",
      key: buildRateLimitKey(req.headers, "workflow-create", user.id),
      limit: 15,
      windowMs: 60_000,
    });
    const input = createWorkflowSchema.parse(await req.json());
    return jsonResponse(await createWorkflow(user.id, input), 201);
  } catch (error) {
    return errorResponse(error, "Unable to create workflow.", getErrorStatus(error, 400));
  }
}
