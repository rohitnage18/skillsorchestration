import { createSkill, listSkills } from "../../../lib/skillStorage.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const filter = url.searchParams.get("filter") || "all";
  return json(listSkills(q, filter));
}

export async function POST(req) {
  const body = await req.json();
  const skillName = String(body.skillName || "").trim();
  const description = String(body.description || "");

  if (!skillName) {
    return json({ error: "skillName is required" }, 400);
  }

  try {
    const created = createSkill(skillName, description);
    return json({ skillName: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create skill";
    const status = message.includes("already exists") ? 409 : 400;
    return json({ error: message }, status);
  }
}
