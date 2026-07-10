import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications,
  markNotificationAsRead,
  clearOldNotifications,
} from "../../../features/logging/server-functions";
import { db } from "../../../lib/db";
import { getErrorStatus, getRequestUser, requireAdmin } from "../../../lib/auth.js";

/**
 * GET /api/notifications
 * Get notifications for current user
 * Query params: read, type, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request.headers);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const read = searchParams.get("read")
      ? searchParams.get("read") === "true"
      : undefined;
    const type = searchParams.get("type") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await getNotifications(user.id, {
      read,
      type: type as any,
      limit,
      offset,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Notifications endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: getErrorStatus(error, 500) }
    );
  }
}

/**
 * POST /api/notifications/:id/read
 * Mark notification as read
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request.headers);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: "notificationId is required" },
        { status: 400 }
      );
    }

    const notification = await db.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
      },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    const result = await markNotificationAsRead(notificationId);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Mark as read endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: getErrorStatus(error, 500) }
    );
  }
}

/**
 * DELETE /api/notifications
 * Clear old notifications
 * Query params: olderThanDays
 * Admin only
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request.headers);
    const searchParams = request.nextUrl.searchParams;
    const olderThanDays = parseInt(searchParams.get("olderThanDays") || "90");

    const result = await clearOldNotifications(olderThanDays);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Clear notifications endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: getErrorStatus(error, 500) }
    );
  }
}

