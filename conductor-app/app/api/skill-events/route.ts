import { z } from "zod";
import { errorResponse, jsonResponse } from "../../../lib/http";
import { logAction } from "../../../features/logging/server-functions";
import {
  assertJsonByteSize,
  assertSafeJsonValue,
  normalizeSkillNameInput,
  sanitizeText,
} from "../../../lib/inputSafety.js";
import { verifyBearerToken } from "../../../lib/productionSecurity.js";
import { resolveExternalEventUser } from "../../../lib/userIdentity.js";

const NOISY_ACTIONS = new Set(["skill:list", "skill:read", "skill:preview", "skill:use"]);
const DEDUPE_WINDOW_MS = 30_000;
const recentEvents = new Map<string, number>();

const eventHeadersSchema = z.object({
  userId: z.string().trim().min(1).max(120),
  userEmail: z.string().trim().email(),
  userName: z.string().trim().min(1).max(120).optional(),
});

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
  skillName: z.string().trim().min(1).transform((value) => normalizeSkillNameInput(value)),
  resourceId: z.string().trim().min(1).max(200).optional(),
  source: z.string().trim().min(1).max(80).default("external").transform((value) => sanitizeText(value, 80, "Source")),
  changes: z.record(z.string(), z.unknown()).optional().transform((value) => value ? assertSafeJsonValue(value, "Changes") : undefined),
  metadata: z.record(z.string(), z.unknown()).optional().transform((value) => value ? assertSafeJsonValue(value, "Metadata") : undefined),
});

export async function POST(req: Request) {
  try {
    const configuredToken = process.env.SKILL_EVENTS_TOKEN;
    if (!configuredToken) {
      return jsonResponse({ error: "Skill event token is not configured." }, 503);
    }

    const authHeader = req.headers.get("authorization") ?? "";
    if (!verifyBearerToken(authHeader, configuredToken)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const eventHeaders = eventHeadersSchema.parse({
      userId: req.headers.get("x-user-id"),
      userEmail: req.headers.get("x-user-email"),
      userName: req.headers.get("x-user-name") || undefined,
    });
    const rawInput = await req.json();
    assertJsonByteSize(rawInput, undefined, "Skill event payload");
    const input = skillEventSchema.parse(rawInput);
    const resourceId = input.resourceId ?? input.skillName;
    const dedupeKey = `${eventHeaders.userId}:${input.action}:${resourceId}:${input.source}`;
    const now = Date.now();

    if (NOISY_ACTIONS.has(input.action)) {
      const lastSeenAt = recentEvents.get(dedupeKey) ?? 0;
      if (now - lastSeenAt < DEDUPE_WINDOW_MS) {
        return jsonResponse({ success: true, deduplicated: true }, 202);
      }
      recentEvents.set(dedupeKey, now);
      pruneRecentEvents(now);
    }

    const resolvedUser = await resolveExternalEventUser({
      externalUserId: eventHeaders.userId,
      email: eventHeaders.userEmail,
      name: eventHeaders.userName,
    });

    await logAction({
      userId: resolvedUser.id,
      action: input.action,
      resource: "skill",
      resourceId,
      changes: input.changes,
      metadata: {
        skillName: input.skillName,
        source: input.source,
        ...input.metadata,
      },
    });

    return jsonResponse({ success: true }, 202);
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error && typeof error.status === "number"
        ? error.status
        : 400;
    return errorResponse(error, "Unable to record skill event.", status);
  }
}

function pruneRecentEvents(now: number) {
  if (recentEvents.size < 1000) {
    return;
  }

  for (const [key, timestamp] of recentEvents.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      recentEvents.delete(key);
    }
  }
}
