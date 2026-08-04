import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getErrorStatus, requireUser } from "../../../lib/auth.js";
import { errorResponse } from "../../../lib/http";
import {
  createSkillChangeRequest,
  listSkillChangeRequests,
} from "../../../lib/skillChangeRequests.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../lib/requestSecurity.js";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request.headers);
    const requests = await listSkillChangeRequests(user);
    return NextResponse.json({ success: true, data: requests });
  } catch (error) {
    return errorResponse(error, "Unable to load skill change requests.", getErrorStatus(error, 500));
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request.headers);
    await enforceRateLimit({
      bucket: "skill-change-request-create",
      key: buildRateLimitKey(request.headers, "skill-change-request-create", user.id),
      limit: 20,
      windowMs: 60_000,
    });
    const skillChangeRequest = await createSkillChangeRequest(user.id, await request.json());
    return NextResponse.json({ success: true, data: skillChangeRequest }, { status: 201 });
  } catch (error) {
    const status = error instanceof ZodError ? 400 : getErrorStatus(error, 500);
    return errorResponse(error, "Unable to create skill change request.", status);
  }
}
