import { loadFile, saveFile } from "../../../../../lib/skillStorage.js";
import { getErrorStatus, requireAdmin } from "../../../../../lib/auth.js";
import {
  assertSkillFileContent,
  normalizeEditableSkillPath,
  normalizeSkillNameInput,
} from "../../../../../lib/inputSafety.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req, { params }) {
  try {
    const { skillName } = await params;
    const safeSkillName = normalizeSkillNameInput(skillName);
    const url = new URL(req.url);
    const filePath = normalizeEditableSkillPath(url.searchParams.get("path"));
    const content = loadFile(safeSkillName, filePath);
    return json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read file";
    return json({ error: message }, 404);
  }
}

export async function POST(req, { params }) {
  try {
    const user = await requireAdmin(req.headers);
    const { skillName } = await params;
    const safeSkillName = normalizeSkillNameInput(skillName);
    const body = await req.json();
    const filePath = normalizeEditableSkillPath(body.path);
    const content = assertSkillFileContent(body.content);

    await saveFile(safeSkillName, filePath, content, user.id);
    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save file";
    const status = message.includes("outside") ? 400 : 500;
    return json({ error: message }, getErrorStatus(error, status));
  }
}
