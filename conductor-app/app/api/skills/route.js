import { createSkill, listSkills } from "../../../lib/skillStorage.js";
import { getErrorStatus, requireAdmin } from "../../../lib/auth.js";
import { sanitizeDescription, sanitizeText, normalizeSkillNameInput } from "../../../lib/inputSafety.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req) {
  const url = new URL(req.url);
  const q = sanitizeText(url.searchParams.get("q") || "", 100, "Search query");
  const filter = sanitizeText(url.searchParams.get("filter") || "all", 20, "Filter");
  return json(listSkills(q, filter));
}

export async function POST(req) {
  try {
    const user = await requireAdmin(req.headers);
    const body = await req.json();
    const skillName = normalizeSkillNameInput(body.skillName);
    const description = sanitizeDescription(body.description);

    const created = await createSkill(skillName, description, user.id);
    return json({ skillName: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create skill";
    const status = message.includes("already exists") ? 409 : 400;
    return json({ error: message }, getErrorStatus(error, status));
  }
}
