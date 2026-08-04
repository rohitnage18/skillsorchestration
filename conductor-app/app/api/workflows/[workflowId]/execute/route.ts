import { errorResponse, getRouteErrorStatus, jsonResponse } from "../../../../../lib/http";
import { executeWorkflowSchema } from "../../../../../features/workflows/schemas";
import { executeWorkflow } from "../../../../../features/workflows/engine";
import { requirePermission } from "../../../../../lib/auth.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../lib/requestSecurity.js";

type RouteContext = {
  params: Promise<{ workflowId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const { workflowId } = await context.params;
    const user = await requirePermission(req.headers, "workflows:use");
    await enforceRateLimit({
      bucket: "workflow-execute",
      key: buildRateLimitKey(req.headers, "workflow-execute", user.id),
      limit: 30,
      windowMs: 60_000,
    });
    const { input } = executeWorkflowSchema.parse(await req.json());
    return jsonResponse(await executeWorkflow(user.id, workflowId, input));
  } catch (error) {
    return errorResponse(error, "Unable to execute workflow.", getRouteErrorStatus(error));
  }
}
