import { access, cp, mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export type SkillClient = "codex" | "claude-code";

export interface SkillInstallResult {
  client: SkillClient;
  skillName: string;
  destination: string;
  status: "imported" | "already-installed";
  invocation: string;
}

function safeSkillName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!SKILL_NAME_PATTERN.test(normalized)) {
    throw new Error(
      "Skill name must be 1-80 characters and use only lowercase letters, numbers, hyphens, or underscores."
    );
  }
  return normalized;
}

function safeChild(root: string, ...parts: string[]): string {
  const resolvedRoot = resolve(root);
  const destination = resolve(resolvedRoot, ...parts);
  const relation = relative(resolvedRoot, destination);
  if (!relation || relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("Invalid skill installation destination.");
  }
  return destination;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function installSkillForClient(
  skillsPath: string,
  projectPath: string,
  skillNameInput: string,
  client: SkillClient
): Promise<SkillInstallResult> {
  const skillName = safeSkillName(skillNameInput);
  const source = safeChild(skillsPath, skillName);
  const skillFile = join(source, "SKILL.md");
  if (!(await exists(skillFile))) {
    throw new Error(`No skill named "${skillName}" was found in the configured skill library.`);
  }

  const clientRoot =
    client === "codex"
      ? safeChild(projectPath, ".agents", "skills")
      : safeChild(projectPath, ".claude", "skills");
  const destination = safeChild(clientRoot, skillName);

  if (await exists(destination)) {
    return {
      client,
      skillName,
      destination,
      status: "already-installed",
      invocation: client === "codex" ? `$${skillName}` : `/${skillName}`,
    };
  }

  await mkdir(clientRoot, { recursive: true });
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false });

  return {
    client,
    skillName,
    destination,
    status: "imported",
    invocation: client === "codex" ? `$${skillName}` : `/${skillName}`,
  };
}

export function formatSkillInstallConfirmation(result: SkillInstallResult): string {
  const clientLabel = result.client === "codex" ? "Codex" : "Claude Code";
  const verb = result.status === "imported" ? "imported successfully" : "already installed";
  return (
    `Skill "${result.skillName}" is ${verb} for ${clientLabel}.\n` +
    `Location: ${result.destination}\n` +
    `Invoke it with ${result.invocation}. If it does not appear in the client's skill list, start a new chat or restart the client.`
  );
}
