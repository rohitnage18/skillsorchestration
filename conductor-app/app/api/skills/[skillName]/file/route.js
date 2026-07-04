import { loadFile, saveFile } from "../../../../../lib/skillStorage.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req, { params }) {
  try {
    const { skillName } = await params;
    const url = new URL(req.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return json({ error: "path parameter is required" }, 400);
    }
    const content = loadFile(skillName, filePath);
    return json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read file";
    return json({ error: message }, 404);
  }
}

export async function POST(req, { params }) {
  try {
    const { skillName } = await params;
    const body = await req.json();
    const filePath = String(body.path || "").trim();
    const content = String(body.content || "");

    if (!filePath) {
      return json({ error: "path is required" }, 400);
    }

    saveFile(skillName, filePath, content);
    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save file";
    const status = message.includes("outside") ? 400 : 500;
    return json({ error: message }, status);
  }
}
