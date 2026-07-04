import { loadSkill } from "../../../../lib/skillStorage.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req, { params }) {
  try {
    const { skillName } = await params;
    return json(loadSkill(skillName));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load skill";
    return json({ error: message }, 404);
  }
}
