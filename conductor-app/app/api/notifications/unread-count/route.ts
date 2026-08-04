import { NextRequest, NextResponse } from "next/server";
import { getUnreadNotificationCount } from "../../../../features/logging/server-functions";
import { getErrorStatus, requireUser } from "../../../../lib/auth.js";
import { errorResponse } from "../../../../lib/http";

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request.headers);

    const result = await getUnreadNotificationCount(user.id);

    if (!result.success) {
      return errorResponse(new Error(result.error), "Unable to load the unread notification count.", 500);
    }

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(
      error,
      "Unable to load the unread notification count.",
      getErrorStatus(error, 500)
    );
  }
}
