import { importSkill } from "../../../lib/skillStorage.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const skillName = String(body.skillName || "").trim();
    const targetName = String(body.targetName || "").trim();

    if (!skillName) {
      return json({ error: "skillName is required" }, 400);
    }
    if (!targetName) {
      return json({ error: "targetName is required" }, 400);
    }

    const destination = await importSkill(skillName, targetName);
    return json({ path: destination });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import skill";
    return json({ error: message }, 400);
  }
}
