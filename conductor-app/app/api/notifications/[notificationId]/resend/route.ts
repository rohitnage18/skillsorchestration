import { NextResponse } from "next/server";
import { getErrorStatus, requirePermission } from "../../../../../lib/auth.js";
import { resendNotificationEmail } from "../../../../../features/logging/server-functions";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../lib/requestSecurity.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    await requirePermission(request.headers, "notifications:resend");
    enforceRateLimit({
      bucket: "notifications-resend",
      key: buildRateLimitKey(request.headers, "notifications-resend"),
      limit: 10,
      windowMs: 60_000,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin permission is required." },
      { status: getErrorStatus(error, 403) }
    );
  }

  const { notificationId } = await params;
  const result = await resendNotificationEmail(notificationId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
