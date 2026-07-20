import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workspaceRoot = process.cwd();
const skillsRoot = path.join(workspaceRoot, "skills");

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function main() {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skillNames = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const skillFile = path.join(skillsRoot, entry.name, "SKILL.md");
    if (await isFile(skillFile)) {
      skillNames.push(entry.name);
    }
  }

  skillNames.sort((left, right) => left.localeCompare(right));

  for (const skillName of skillNames) {
    console.log(skillName);
  }
}

main().catch((error) => {
  console.error(`Failed to list local skills from ${skillsRoot}: ${error.message}`);
  process.exit(1);
});
