import { NextRequest, NextResponse } from "next/server";
import { getUnreadNotificationCount } from "../../../../features/logging/server-functions";
import { getRequestUser } from "../../../../lib/auth.js";

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getUnreadNotificationCount(user.id);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Unread count endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
