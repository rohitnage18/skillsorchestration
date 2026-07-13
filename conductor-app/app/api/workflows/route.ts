import { errorResponse, jsonResponse } from "../../../lib/http";
import { createWorkflowSchema } from "../../../features/workflows/schemas";
import { createWorkflow, getOwnerId, listWorkflows } from "../../../features/workflows/service";
import { getErrorStatus, requireAdmin } from "../../../lib/auth.js";

export async function GET(req: Request) {
  try {
    return jsonResponse(await listWorkflows(await getOwnerId(req.headers)));
  } catch (error) {
    return errorResponse(error, "Unable to list workflows.", getErrorStatus(error));
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin(req.headers);
    const input = createWorkflowSchema.parse(await req.json());
    return jsonResponse(await createWorkflow(user.id, input), 201);
  } catch (error) {
    return errorResponse(error, "Unable to create workflow.", getErrorStatus(error, 400));
  }
}
