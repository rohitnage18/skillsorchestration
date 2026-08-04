import { NextRequest, NextResponse } from "next/server";
import { getAuditStats } from "../../../../features/logging/server-functions";
import { getErrorStatus, requirePermission } from "../../../../lib/auth.js";
import { errorResponse } from "../../../../lib/http";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request.headers, "audit_logs:read");

    const timeframeParam = request.nextUrl.searchParams.get("timeframe") ?? "week";
    const timeframe = ["day", "week", "month"].includes(timeframeParam)
      ? (timeframeParam as "day" | "week" | "month")
      : "week";

    const result = await getAuditStats(timeframe);

    if (!result.success) {
      return errorResponse(new Error(result.error), "Unable to load audit statistics.", 500);
    }

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to load audit statistics.", getErrorStatus(error, 500));
  }
}
