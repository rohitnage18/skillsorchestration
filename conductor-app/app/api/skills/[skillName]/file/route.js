import { loadFile, saveFile } from "../../../../../lib/skillStorage.js";
import { requirePermission } from "../../../../../lib/auth.js";
import {
  assertSkillFileContent,
  normalizeEditableSkillPath,
  normalizeSkillNameInput,
} from "../../../../../lib/inputSafety.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../../../lib/requestSecurity.js";
import { errorResponse, getRouteErrorStatus } from "../../../../../lib/http.ts";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req, { params }) {
  try {
    await requirePermission(req.headers, "skills:use");
    const { skillName } = await params;
    const safeSkillName = normalizeSkillNameInput(skillName);
    const url = new URL(req.url);
    const filePath = normalizeEditableSkillPath(url.searchParams.get("path"));
    const content = loadFile(safeSkillName, filePath);
    return json({ content });
  } catch (error) {
    return errorResponse(error, "Unable to read file.", getRouteErrorStatus(error));
  }
}

export async function POST(req, { params }) {
  try {
    const user = await requirePermission(req.headers, "skills:manage");
    await enforceRateLimit({
      bucket: "skill-file-update",
      key: buildRateLimitKey(req.headers, "skill-file-update", user.id),
      limit: 40,
      windowMs: 60_000,
    });
    const { skillName } = await params;
    const safeSkillName = normalizeSkillNameInput(skillName);
    const body = await req.json();
    const filePath = normalizeEditableSkillPath(body.path);
    const content = assertSkillFileContent(body.content);

    await saveFile(safeSkillName, filePath, content, user.id);
    return json({ success: true });
  } catch (error) {
    return errorResponse(error, "Unable to save file.", getRouteErrorStatus(error));
  }
}
