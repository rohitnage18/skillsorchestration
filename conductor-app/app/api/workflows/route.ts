import { errorResponse, jsonResponse } from "../../../lib/http";
import { createWorkflowSchema } from "../../../features/workflows/schemas";
import { createWorkflow, getOwnerId, listWorkflows } from "../../../features/workflows/service";

export async function GET(req: Request) {
  try {
    return jsonResponse(await listWorkflows(await getOwnerId(req.headers)));
  } catch (error) {
    return errorResponse(error, "Unable to list workflows.");
  }
}

export async function POST(req: Request) {
  try {
    const input = createWorkflowSchema.parse(await req.json());
    return jsonResponse(await createWorkflow(await getOwnerId(req.headers), input), 201);
  } catch (error) {
    return errorResponse(error, "Unable to create workflow.", 400);
  }
}
