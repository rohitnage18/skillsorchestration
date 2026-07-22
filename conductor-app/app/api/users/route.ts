import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorStatus, requirePermission } from "../../../lib/auth.js";
import { db } from "../../../lib/db";
import { buildRateLimitKey, enforceRateLimit } from "../../../lib/requestSecurity.js";
import { logAction } from "../../../features/logging/server-functions";

export const upsertUserSchema = z.object({
  id: z.string().trim().min(1).optional(),
  email: z.string().trim().email(),
  name: z.string().trim().min(1).optional(),
  externalUserId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]+$/, "External user id may contain only letters, numbers, dots, underscores, and hyphens.")
    .optional(),
  preferredBranch: z
    .string()
    .trim()
    .regex(/^(users\/[A-Za-z0-9._-]+|[A-Za-z0-9._-]+)$/, "Preferred branch must be a personal branch such as users/sanay or sanay.")
    .optional(),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  status: z.enum(["INVITED", "PENDING", "ACTIVE", "DISABLED"]).default("INVITED"),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request.headers, "users:manage");

    const users = await db.user.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        externalUserId: true,
        preferredBranch: true,
        lastSeenAt: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Users endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: getErrorStatus(error, 500) }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(request.headers, "users:manage");
    enforceRateLimit({
      bucket: "users-upsert",
      key: buildRateLimitKey(request.headers, "users-upsert"),
      limit: 20,
      windowMs: 60_000,
    });

    const input = upsertUserSchema.parse(await request.json());
    const data = {
      email: input.email,
      name: input.name ?? null,
      externalUserId: input.externalUserId ?? null,
      preferredBranch: input.preferredBranch ?? null,
      role: input.role,
      status: input.status,
    };
    const select = {
        id: true,
        email: true,
        name: true,
        externalUserId: true,
        preferredBranch: true,
        lastSeenAt: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
    };
    const user = input.id
      ? await db.user.upsert({ where: { id: input.id }, update: data, create: { id: input.id, ...data }, select })
      : await db.user.create({ data, select });

    await logAction({
      userId: actor.id,
      action: input.id ? "user:update" : "user:invite",
      resource: "user",
      resourceId: user.id,
      changes: { after: { email: user.email, role: user.role, status: user.status } },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error("Create/update user endpoint error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid user details." }, { status: 422 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "A user with that email or external ID already exists." }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create or update user." },
      { status: getErrorStatus(error, 400) }
    );
  }
}
