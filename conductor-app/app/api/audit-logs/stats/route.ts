import { NextRequest, NextResponse } from "next/server";
import { getAuditStats } from "../../../../features/logging/server-functions";
import { getErrorStatus, requirePermission } from "../../../../lib/auth.js";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request.headers, "audit_logs:read");

    const timeframeParam = request.nextUrl.searchParams.get("timeframe") ?? "week";
    const timeframe = ["day", "week", "month"].includes(timeframeParam)
      ? (timeframeParam as "day" | "week" | "month")
      : "week";

    const result = await getAuditStats(timeframe);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit stats endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: getErrorStatus(error, 500) }
    );
  }
}
