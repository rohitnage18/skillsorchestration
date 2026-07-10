import { errorResponse, jsonResponse } from "../../../../lib/http";
import { db } from "../../../../lib/db";
import { getOwnerId } from "../../../../features/workflows/service";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const ownerId = await getOwnerId(req.headers);
    const run = await db.workflowRun.findFirst({
      where: {
        id: runId,
        userId: ownerId,
      },
      include: { nodeRuns: true },
    });

    if (!run) {
      return jsonResponse({ error: "Run not found." }, 404);
    }

    return jsonResponse(run);
  } catch (error) {
    return errorResponse(error, "Unable to load workflow run.", 400);
  }
}
