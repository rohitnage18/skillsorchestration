import { NextRequest, NextResponse } from "next/server";
import { getErrorStatus, requireAdmin } from "../../../../../lib/auth.js";
import { rejectSkillChangeRequest } from "../../../../../lib/skillChangeRequests.js";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAdmin(request.headers);
    const { requestId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const skillChangeRequest = await rejectSkillChangeRequest(requestId, user.id, body);
    return NextResponse.json({ success: true, data: skillChangeRequest });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reject skill change request." },
      { status: getErrorStatus(error, 400) }
    );
  }
}
