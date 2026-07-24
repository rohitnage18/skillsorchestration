import { createHmac, randomUUID } from "node:crypto";

interface SkillEventInput {
  action: "skill:preview" | "skill:use" | "skill:file:update";
  skillName: string;
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
  config: SkillEventRequestConfig
): { headers: Record<string, string>; body: string } {
  const body = JSON.stringify({
    action: event.action,
    skillName: event.skillName,
    source: "vscode-extension",
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
    const timestamp = String(Date.now());
    const eventId = randomUUID();
    headers["x-skill-event-id"] = eventId;
    headers["x-skill-event-timestamp"] = timestamp;
    headers["x-skill-event-signature"] = createHmac("sha256", config.hmacSecret)
      .update(`${timestamp}.${eventId}.${body}`)
      .digest("hex");
  }

  return { headers, body };
}
