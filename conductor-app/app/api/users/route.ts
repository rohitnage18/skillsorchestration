import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorStatus, requireAdmin } from "../../../lib/auth.js";
import { db } from "../../../lib/db";

const upsertUserSchema = z.object({
  id: z.string().trim().min(1),
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
    await requireAdmin(request.headers);

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
    await requireAdmin(request.headers);

    const input = upsertUserSchema.parse(await request.json());
    const user = await db.user.upsert({
      where: { id: input.id },
      update: {
        email: input.email,
        name: input.name ?? null,
        externalUserId: input.externalUserId ?? null,
        preferredBranch: input.preferredBranch ?? null,
        role: input.role,
        status: input.status,
      },
      create: {
        id: input.id,
        email: input.email,
        name: input.name ?? null,
        externalUserId: input.externalUserId ?? null,
        preferredBranch: input.preferredBranch ?? null,
        role: input.role,
        status: input.status,
      },
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

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error("Create/update user endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create or update user." },
      { status: getErrorStatus(error, 400) }
    );
  }
}
