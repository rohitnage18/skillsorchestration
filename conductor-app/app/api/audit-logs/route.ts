import { NextRequest, NextResponse } from "next/server";
import {
  getAuditLogs,
  getAuditStats,
  logAction,
  purgeOldAuditLogs,
} from "../../../features/logging/server-functions";

/**
 * GET /api/audit-logs
 * Get audit logs with optional filtering
 * Query params: userId, resource, action, limit, offset
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authorization check
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || undefined;
    const resource = searchParams.get("resource") || undefined;
    const action = searchParams.get("action") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await getAuditLogs({
      userId,
      resource,
      action,
      limit,
      offset,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit logs endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit-logs/action
 * Log an action (called by services)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await logAction(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Log action endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/audit-logs
 * Purge old audit logs
 * Query params: olderThanDays
 * Admin only
 */
export async function DELETE(request: NextRequest) {
  try {
    // TODO: Add admin authorization check
    const searchParams = request.nextUrl.searchParams;
    const olderThanDays = parseInt(searchParams.get("olderThanDays") || "90");

    const result = await purgeOldAuditLogs(olderThanDays);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Purge audit logs endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
