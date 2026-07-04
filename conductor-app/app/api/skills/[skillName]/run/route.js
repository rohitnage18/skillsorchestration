import { listSkillFiles, loadSkill } from "../../../../../lib/skillStorage.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function simulateSkillTest(skillName) {
  const files = listSkillFiles(skillName);
  const skill = loadSkill(skillName);
  const checks = [];

  checks.push({
    label: "Skill folder readability",
    status: files.length > 0 ? "pass" : "fail",
    detail: files.length > 0 ? "Skill files are present." : "No files found in the skill folder.",
  });

  checks.push({
    label: "SKILL metadata exists",
    status: files.some((file) => file.path === "SKILL.md") ? "pass" : "fail",
    detail: files.some((file) => file.path === "SKILL.md") ? "SKILL.md is present." : "SKILL.md is missing.",
  });

  checks.push({
    label: "Reference files count",
    status: files.some((file) => file.type === "reference") ? "pass" : "warn",
    detail: files.some((file) => file.type === "reference") ? "Reference files are available." : "No reference files found.",
  });

  const hasBodyText = skill.skill.trim().length > 0;
  checks.push({
    label: "Skill content loaded",
    status: hasBodyText ? "pass" : "fail",
    detail: hasBodyText ? "The SKILL.md file contains content." : "The SKILL.md file is empty or missing.",
  });

  return {
    status: checks.some((check) => check.status === "fail") ? "failed" : "passed",
    message: checks.some((check) => check.status === "fail")
      ? "One or more checks failed. Review the results."
      : "All checks passed successfully.",
    checks,
  };
}

export async function POST(req, { params }) {
  try {
    const { skillName } = await params;
    const result = simulateSkillTest(skillName);
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run skill test";
    return json({ error: message }, 500);
  }
}
