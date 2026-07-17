import { NextRequest, NextResponse } from "next/server";
import { getErrorStatus, requirePermission } from "../../../../../lib/auth.js";
import { approveSkillChangeRequest } from "../../../../../lib/skillChangeRequests.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../lib/requestSecurity.js";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requirePermission(request.headers, "skill_change_requests:review");
    enforceRateLimit({
      bucket: "skill-change-review",
      key: buildRateLimitKey(request.headers, "skill-change-review", user.id),
      limit: 20,
      windowMs: 60_000,
    });
    const { requestId } = await context.params;
    const skillChangeRequest = await approveSkillChangeRequest(requestId, user.id);
    return NextResponse.json({ success: true, data: skillChangeRequest });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to approve skill change request." },
      { status: getErrorStatus(error, 400) }
    );
  }
}
