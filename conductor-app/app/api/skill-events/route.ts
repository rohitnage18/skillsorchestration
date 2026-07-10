import { z } from "zod";
import { errorResponse, jsonResponse } from "../../../lib/http";
import { db } from "../../../lib/db";
import { logAction } from "../../../features/logging/server-functions";

const skillEventSchema = z.object({
  action: z.enum([
    "skill:list",
    "skill:read",
    "skill:create",
    "skill:import",
    "skill:preview",
    "skill:use",
    "skill:test",
    "skill:execute",
    "skill:file:update",
  ]),
  skillName: z.string().trim().min(1),
  resourceId: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).default("external"),
  changes: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const configuredToken = process.env.SKILL_EVENTS_TOKEN;
    if (configuredToken) {
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
      if (token !== configuredToken) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    const userId = req.headers.get("x-user-id")?.trim() || "dev-user";
    const userEmail = req.headers.get("x-user-email")?.trim() || `${userId}@local.conductor`;
    const input = skillEventSchema.parse(await req.json());

    await db.user.upsert({
      where: { id: userId },
      update: {
        email: userEmail,
      },
      create: {
        id: userId,
        email: userEmail,
      },
    });

    await logAction({
      userId,
      action: input.action,
      resource: "skill",
      resourceId: input.resourceId ?? input.skillName,
      changes: input.changes,
      metadata: {
        skillName: input.skillName,
        source: input.source,
        ...input.metadata,
      },
    });

    return jsonResponse({ success: true }, 202);
  } catch (error) {
    return errorResponse(error, "Unable to record skill event.", 400);
  }
}
