import { createHmac, randomUUID } from "node:crypto";

export type SkillEventAction = "skill:list" | "skill:read" | "skill:import";

export interface SkillEventInput {
  action: SkillEventAction;
  skillName: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

interface SkillEventRequestConfig {
  userId: string;
  userEmail: string;
  userName?: string;
  token?: string;
  hmacSecret?: string;
}

export function buildSkillEventRequest(
  event: SkillEventInput,
  config: SkillEventRequestConfig,
  timestamp: string = String(Date.now()),
  eventId: string = randomUUID()
): { headers: Record<string, string>; body: string } {
  const body = JSON.stringify({
    action: event.action,
    skillName: event.skillName,
    resourceId: event.resourceId,
    source: "skills-mcp-server",
    metadata: event.metadata,
  });
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-user-id": config.userId,
    "x-user-email": config.userEmail,
  };

  if (config.userName) {
    headers["x-user-name"] = config.userName;
  }
  if (config.token) {
    headers.authorization = `Bearer ${config.token}`;
  }
  if (config.hmacSecret) {
    headers["x-skill-event-id"] = eventId;
    headers["x-skill-event-timestamp"] = timestamp;
    headers["x-skill-event-signature"] = createHmac("sha256", config.hmacSecret)
      .update(`${timestamp}.${eventId}.${body}`)
      .digest("hex");
  }

  return { headers, body };
}
