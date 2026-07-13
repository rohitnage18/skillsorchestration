import { listSkillFiles } from "../../../../../lib/skillStorage.js";
import { normalizeSkillNameInput } from "../../../../../lib/inputSafety.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req, { params }) {
  try {
    const { skillName } = await params;
    return json(listSkillFiles(normalizeSkillNameInput(skillName)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list files";
    return json({ error: message }, 404);
  }
}
