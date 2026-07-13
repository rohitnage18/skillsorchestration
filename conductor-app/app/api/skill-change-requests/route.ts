import { NextRequest, NextResponse } from "next/server";
import { getErrorStatus, requireUser } from "../../../lib/auth.js";
import {
  createSkillChangeRequest,
  listSkillChangeRequests,
} from "../../../lib/skillChangeRequests.js";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request.headers);
    const requests = await listSkillChangeRequests(user);
    return NextResponse.json({ success: true, data: requests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load skill change requests." },
      { status: getErrorStatus(error, 500) }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request.headers);
    const skillChangeRequest = await createSkillChangeRequest(user.id, await request.json());
    return NextResponse.json({ success: true, data: skillChangeRequest }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create skill change request." },
      { status: getErrorStatus(error, 400) }
    );
  }
}
