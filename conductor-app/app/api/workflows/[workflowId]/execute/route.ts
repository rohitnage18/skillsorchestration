import { errorResponse, jsonResponse } from "../../../../../lib/http";
import { executeWorkflowSchema } from "../../../../../features/workflows/schemas";
import { executeWorkflow } from "../../../../../features/workflows/engine";
import { getOwnerId } from "../../../../../features/workflows/service";

type RouteContext = {
  params: Promise<{ workflowId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const { workflowId } = await context.params;
    const { input } = executeWorkflowSchema.parse(await req.json());
    return jsonResponse(await executeWorkflow(await getOwnerId(req.headers), workflowId, input));
  } catch (error) {
    return errorResponse(error, "Unable to execute workflow.", 400);
  }
}
