import { errorResponse, jsonResponse } from "../../../../lib/http";
import { updateWorkflowSchema } from "../../../../features/workflows/schemas";
import {
  deleteWorkflow,
  getOwnerId,
  getWorkflow,
  updateWorkflow,
} from "../../../../features/workflows/service";

type RouteContext = {
  params: Promise<{ workflowId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { workflowId } = await context.params;
    return jsonResponse(await getWorkflow(await getOwnerId(req.headers), workflowId));
  } catch (error) {
    return errorResponse(error, "Unable to load workflow.", 404);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { workflowId } = await context.params;
    const input = updateWorkflowSchema.parse(await req.json());
    return jsonResponse(await updateWorkflow(await getOwnerId(req.headers), workflowId, input));
  } catch (error) {
    return errorResponse(error, "Unable to update workflow.", 400);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { workflowId } = await context.params;
    return jsonResponse(await deleteWorkflow(await getOwnerId(req.headers), workflowId));
  } catch (error) {
    return errorResponse(error, "Unable to delete workflow.", 400);
  }
}
