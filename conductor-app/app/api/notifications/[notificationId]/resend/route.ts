import { NextResponse } from "next/server";
import { getErrorStatus, requireAdmin } from "../../../../../lib/auth.js";
import { resendNotificationEmail } from "../../../../../features/logging/server-functions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    await requireAdmin();
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
