import { NextResponse } from "next/server";
import { requirePermission } from "../../../../../lib/auth.js";
import { resendNotificationEmail } from "../../../../../features/logging/server-functions";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../lib/requestSecurity.js";
import { errorResponse, getRouteErrorStatus } from "../../../../../lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    await requirePermission(request.headers, "notifications:resend");
    await enforceRateLimit({
      bucket: "notifications-resend",
      key: buildRateLimitKey(request.headers, "notifications-resend"),
      limit: 10,
      windowMs: 60_000,
    });
  } catch (error) {
    return errorResponse(error, "Unable to authorize notification resend.", getRouteErrorStatus(error));
  }

  const { notificationId } = await params;
  const result = await resendNotificationEmail(notificationId);

  if (!result.success) {
    return errorResponse(new Error(result.error), "Unable to resend notification email.", 500);
  }

  return NextResponse.json(result.data);
}
