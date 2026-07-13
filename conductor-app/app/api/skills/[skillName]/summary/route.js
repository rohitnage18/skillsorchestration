import { listSkillFiles, loadSkill, loadSkillState } from "../../../../../lib/skillStorage.js";
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
    const safeSkillName = normalizeSkillNameInput(skillName);
    const files = listSkillFiles(safeSkillName);
    const skill = loadSkill(safeSkillName);
    const state = loadSkillState(safeSkillName);
    const fileCount = files.length;
    const referenceCount = files.filter((file) => file.type === "reference").length;
    const hasSkillFile = files.some((file) => file.path === "SKILL.md");
    const lastUpdated = new Date().toISOString();

    return json({
      fileCount,
      referenceCount,
      hasSkillFile,
      importedTo: state.importedTo,
      importedAt: state.importedAt,
      lastUpdated,
      skillInfo: {
        name: safeSkillName,
        description: skill.skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim() || "No description",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load skill summary";
    return json({ error: message }, 404);
  }
}
