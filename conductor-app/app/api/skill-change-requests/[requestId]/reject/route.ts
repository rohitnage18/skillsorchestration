import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getErrorStatus, requirePermission } from "../../../../../lib/auth.js";
import { errorResponse } from "../../../../../lib/http";
import { rejectSkillChangeRequest } from "../../../../../lib/skillChangeRequests.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../lib/requestSecurity.js";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requirePermission(request.headers, "skill_change_requests:review");
    await enforceRateLimit({
      bucket: "skill-change-review",
      key: buildRateLimitKey(request.headers, "skill-change-review", user.id),
      limit: 20,
      windowMs: 60_000,
    });
    const { requestId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const skillChangeRequest = await rejectSkillChangeRequest(requestId, user.id, body);
    return NextResponse.json({ success: true, data: skillChangeRequest });
  } catch (error) {
    const status = error instanceof ZodError ? 400 : getErrorStatus(error, 500);
    return errorResponse(error, "Unable to reject skill change request.", status);
  }
}
