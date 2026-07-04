const http = require("http");
const path = require("path");
const fs = require("fs");
const url = require("url");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4174;
const ROOT = path.join(__dirname, "public");
const SKILLS_ROOT = path.join(__dirname, "..", "skills");
const IMPORT_ROOT = path.join(__dirname, "imported-workspaces");

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function sendResponse(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res, data, statusCode = 200) {
  sendResponse(res, statusCode, JSON.stringify(data), "application/json; charset=UTF-8");
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error("Invalid path");
  }
  return resolved;
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function listSkills() {
  try {
    const dirs = fs.readdirSync(SKILLS_ROOT, { withFileTypes: true });
    return dirs
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => {
        const skillMdPath = path.join(SKILLS_ROOT, entry.name, "SKILL.md");
        let description = "No description";
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, "utf-8");
          const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (match) {
            const descMatch = match[1].match(/^description:\s*(.+)$/m);
            if (descMatch) {
              description = descMatch[1].trim();
            }
          }
        }
        return { name: entry.name, description };
      });
  } catch (err) {
    return [];
  }
}

function loadSkillContent(skillName) {
  const skillDir = safeJoin(SKILLS_ROOT, skillName);
  const skillMdPath = path.join(skillDir, "SKILL.md");
  const referencesDir = path.join(skillDir, "references");
  const skillMd = fs.existsSync(skillMdPath) ? fs.readFileSync(skillMdPath, "utf-8") : "";
  const refs = [];
  if (fs.existsSync(referencesDir)) {
    const files = fs.readdirSync(referencesDir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".md")) {
        refs.push({ name: file.name, content: fs.readFileSync(path.join(referencesDir, file.name), "utf-8") });
      }
    }
  }
  return { skill: skillMd, references: refs };
}

function listSkillFiles(skillName) {
  const skillDir = safeJoin(SKILLS_ROOT, skillName);
  const files = [];
  const skillMdPath = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(skillMdPath)) {
    files.push({ path: "SKILL.md", name: "SKILL.md", type: "skill" });
  }
  const referencesDir = path.join(skillDir, "references");
  if (fs.existsSync(referencesDir)) {
    const entries = fs.readdirSync(referencesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ path: `references/${entry.name}`, name: entry.name, type: "reference" });
      }
    }
  }
  return files;
}

function loadFileContent(skillName, relativePath) {
  const skillDir = safeJoin(SKILLS_ROOT, skillName);
  const filePath = safeJoin(skillDir, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return fs.readFileSync(filePath, "utf-8");
}

function saveFileContent(skillName, relativePath, content) {
  const skillDir = safeJoin(SKILLS_ROOT, skillName);
  const filePath = safeJoin(skillDir, relativePath);
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

function ensureProjectContextFile(projectDir, projectName) {
  const contextPath = path.join(projectDir, "CONTEXT.md");
  if (fs.existsSync(contextPath)) {
    return contextPath;
  }

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const content = `# Project Context

> This file is maintained automatically for the imported project.
> Read it at the start of each work session and update it as work progresses.

## Project overview

${projectName} is an imported project folder in the skill orchestration workspace.

## Stack

- Skill orchestration workspace
- Prisma-backed persistence
- Next.js and Node.js tooling

## Current status

- Project imported and ready for review.

## Open questions / blockers

- None recorded yet.

## Decisions log

- Initial context scaffold created automatically.

## Changelog

### ${timestamp}

Initial context scaffold created for this project.
`;

  fs.writeFileSync(contextPath, content, "utf-8");
  return contextPath;
}

function importSkill(skillName, importName) {
  const sourceDir = safeJoin(SKILLS_ROOT, skillName);
  const targetName = importName.trim() || skillName;
  const destinationDir = safeJoin(IMPORT_ROOT, targetName);
  if (!fs.existsSync(IMPORT_ROOT)) {
    fs.mkdirSync(IMPORT_ROOT, { recursive: true });
  }
  if (fs.existsSync(destinationDir)) {
    throw new Error(`Import destination already exists: ${targetName}`);
  }
  fs.cpSync(sourceDir, destinationDir, { recursive: true });
  ensureProjectContextFile(destinationDir, targetName);
  return destinationDir;
}

function sanitizeSkillName(name) {
  const normalized = name.trim().replace(/\s+/g, "-").toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    throw new Error("Skill name may only contain letters, numbers, hyphens, and underscores.");
  }
  return normalized;
}

function createSkill(skillName, description) {
  const sanitized = sanitizeSkillName(skillName);
  const destinationDir = safeJoin(SKILLS_ROOT, sanitized);
  if (fs.existsSync(destinationDir)) {
    throw new Error(`Skill already exists: ${sanitized}`);
  }
  fs.mkdirSync(destinationDir, { recursive: true });
  const skillContent = `---\nname: ${sanitized}\ndescription: ${description || "New skill"}\n---\n\n# ${sanitized}\n\nDescribe this skill here.\n`;
  fs.writeFileSync(path.join(destinationDir, "SKILL.md"), skillContent, "utf-8");
  fs.mkdirSync(path.join(destinationDir, "references"), { recursive: true });
  return sanitized;
}

function listImportTargets() {
  if (!fs.existsSync(IMPORT_ROOT)) {
    return [];
  }
  const entries = fs.readdirSync(IMPORT_ROOT, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || "/";

  try {
    if (pathname === "/" || pathname === "/index.html") {
      const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf-8");
      sendResponse(res, 200, html, "text/html; charset=UTF-8");
      return;
    }

    if (pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      if (pathname === "/api/skills") {
        if (req.method === "POST") {
          const body = await collectRequestBody(req);
          const skillName = String(body.skillName || "");
          const description = String(body.description || "");
          if (!skillName) {
            sendJson(res, { error: "skillName is required" }, 400);
            return;
          }
          try {
            const createdName = createSkill(skillName, description);
            sendJson(res, { created: true, skillName: createdName });
          } catch (err) {
            sendJson(res, { error: err.message }, 400);
          }
          return;
        }

        const query = parsed.query.q ? String(parsed.query.q).toLowerCase() : "";
        const allSkills = listSkills();
        const filtered = query
          ? allSkills.filter((skill) => skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query))
          : allSkills;
        sendJson(res, filtered);
        return;
      }

      if (pathname === "/api/imports" && req.method === "GET") {
        sendJson(res, listImportTargets());
        return;
      }

      if (pathname.startsWith("/api/skills/")) {
        const remainder = pathname.replace("/api/skills/", "");
        const [skillName, action] = remainder.split("/");
        if (!skillName) {
          sendJson(res, { error: "Skill name required" }, 400);
          return;
        }

        if (!fs.existsSync(safeJoin(SKILLS_ROOT, skillName))) {
          sendJson(res, { error: "Skill not found" }, 404);
          return;
        }

        if (!action) {
          const data = loadSkillContent(skillName);
          sendJson(res, data);
          return;
        }

        if (action === "files" && req.method === "GET") {
          sendJson(res, listSkillFiles(skillName));
          return;
        }

        if (action === "file") {
          if (req.method === "GET") {
            const filePath = String(parsed.query.path || "SKILL.md");
            const content = loadFileContent(skillName, filePath);
            sendJson(res, { path: filePath, content });
            return;
          }
          if (req.method === "POST") {
            const body = await collectRequestBody(req);
            const filePath = String(body.path || "SKILL.md");
            const content = String(body.content || "");
            saveFileContent(skillName, filePath, content);
            sendJson(res, { saved: true, path: filePath });
            return;
          }
        }
      }

      if (pathname === "/api/import" && req.method === "POST") {
        const body = await collectRequestBody(req);
        const skillName = String(body.skillName || "");
        const targetName = String(body.targetName || skillName);
        if (!skillName) {
          sendJson(res, { error: "skillName is required" }, 400);
          return;
        }
        try {
          const destination = importSkill(skillName, targetName);
          sendJson(res, { imported: true, path: destination });
        } catch (err) {
          sendJson(res, { error: err.message }, 400);
        }
        return;
      }
    }

    const filePath = safeJoin(ROOT, pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const type = MIME_TYPES[ext] || "application/octet-stream";
      const body = fs.readFileSync(filePath);
      sendResponse(res, 200, body, type);
      return;
    }

    sendResponse(res, 404, "Not found", "text/plain; charset=UTF-8");
  } catch (err) {
    sendResponse(res, 500, `Server error: ${err.message}`, "text/plain; charset=UTF-8");
  }
});

server.listen(PORT, () => {
  console.log(`Conductor app listening on http://localhost:${PORT}`);
});
