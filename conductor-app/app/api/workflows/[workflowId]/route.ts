import { errorResponse, jsonResponse } from "../../../../lib/http";
import { updateWorkflowSchema } from "../../../../features/workflows/schemas";
import {
  deleteWorkflow,
  getOwnerId,
  getWorkflow,
  updateWorkflow,
} from "../../../../features/workflows/service";
import { getErrorStatus, requirePermission } from "../../../../lib/auth.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../lib/requestSecurity.js";

type RouteContext = {
  params: Promise<{ workflowId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { workflowId } = await context.params;
    return jsonResponse(await getWorkflow(await getOwnerId(req.headers), workflowId));
  } catch (error) {
    return errorResponse(error, "Unable to load workflow.", getErrorStatus(error, 404));
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { workflowId } = await context.params;
    const user = await requirePermission(req.headers, "workflows:manage");
    enforceRateLimit({
      bucket: "workflow-update",
      key: buildRateLimitKey(req.headers, "workflow-update", user.id),
      limit: 30,
      windowMs: 60_000,
    });
    const input = updateWorkflowSchema.parse(await req.json());
    return jsonResponse(await updateWorkflow(user.id, workflowId, input));
  } catch (error) {
    return errorResponse(error, "Unable to update workflow.", getErrorStatus(error, 400));
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { workflowId } = await context.params;
    const user = await requirePermission(req.headers, "workflows:manage");
    enforceRateLimit({
      bucket: "workflow-delete",
      key: buildRateLimitKey(req.headers, "workflow-delete", user.id),
      limit: 10,
      windowMs: 60_000,
    });
    return jsonResponse(await deleteWorkflow(user.id, workflowId));
  } catch (error) {
    return errorResponse(error, "Unable to delete workflow.", getErrorStatus(error, 400));
  }
}
