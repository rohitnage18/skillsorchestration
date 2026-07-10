/**
 * Skills Library — VS Code extension entry point.
 *
 * Provides a sidebar tree view of a local SKILL.md library (the same
 * skills/ folder used by skills-mcp-server's SKILLS_PATH) and lets you:
 *   - browse skills and their reference files
 *   - preview any skill or reference file in a read-only editor tab
 *   - insert a skill's full content (router + all references) at the
 *     cursor position in whatever text editor you were last working in
 */

import * as vscode from "vscode";
import * as path from "node:path";
import { discoverSkills, getFullSkillContent, SkillInfo } from "./skills";
import { SkillsTreeDataProvider, SkillTreeNode } from "./skillsTreeProvider";

const PREVIEW_SCHEME = "skills-preview";

type SkillEventAction = "skill:preview" | "skill:use" | "skill:file:update";

interface SkillEventInput {
  action: SkillEventAction;
  skillName: string;
  metadata?: Record<string, unknown>;
}

/** Reads the configured skills folder path, expanding ~ for convenience. */
function getConfiguredSkillsPath(): string {
  const raw = vscode.workspace.getConfiguration("skillsLibrary").get<string>("skillsPath", "");
  if (raw.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return path.join(home, raw.slice(1));
  }
  return raw;
}

function getConductorUrl(): string {
  return vscode.workspace
    .getConfiguration("skillsLibrary")
    .get<string>("conductorUrl", "")
    .trim()
    .replace(/\/+$/, "");
}

function getConfiguredUserId(): string {
  return (
    vscode.workspace.getConfiguration("skillsLibrary").get<string>("userId", "").trim() ||
    process.env.USER ||
    process.env.USERNAME ||
    "vscode-user"
  );
}

function getConfiguredUserEmail(userId: string): string {
  return (
    vscode.workspace.getConfiguration("skillsLibrary").get<string>("userEmail", "").trim() ||
    (userId.includes("@") ? userId : `${userId}@local.conductor`)
  );
}

function getEventToken(): string {
  return vscode.workspace.getConfiguration("skillsLibrary").get<string>("eventToken", "").trim();
}

function getSkillFileEvent(skillsPath: string, uri: vscode.Uri): SkillEventInput | undefined {
  if (uri.scheme !== "file") {
    return undefined;
  }

  const relativePath = path.relative(skillsPath, uri.fsPath).replace(/\\/g, "/");
  if (relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  const parts = relativePath.split("/");
  const [skillName, firstChild, fileName] = parts;
  if (!skillName) {
    return undefined;
  }

  if (firstChild === "SKILL.md" && parts.length === 2) {
    return {
      action: "skill:file:update",
      skillName,
      metadata: {
        filePath: "SKILL.md",
        fileType: "skill",
        source: "vscode-extension",
      },
    };
  }

  if (firstChild === "references" && parts.length === 3 && fileName?.endsWith(".md")) {
    return {
      action: "skill:file:update",
      skillName,
      metadata: {
        filePath: `references/${fileName}`,
        fileType: "reference",
        source: "vscode-extension",
      },
    };
  }

  return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  // Tracks the most recently active *text* editor (not the preview/output
  // panel itself) so "Insert at Cursor" has somewhere sensible to insert
  // into even after the user has clicked into the sidebar or a preview tab.
  let lastActiveTextEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.uri.scheme === "file") {
        lastActiveTextEditor = editor;
      }
    })
  );

  const treeProvider = new SkillsTreeDataProvider(getConfiguredSkillsPath);
  const outputChannel = vscode.window.createOutputChannel("Skills Library");
  context.subscriptions.push(outputChannel);

  async function reportSkillEvent(event: SkillEventInput): Promise<void> {
    const conductorUrl = getConductorUrl();
    if (!conductorUrl) {
      return;
    }

    const userId = getConfiguredUserId();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-user-id": userId,
      "x-user-email": getConfiguredUserEmail(userId),
    };
    const token = getEventToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${conductorUrl}/api/skill-events`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: event.action,
          skillName: event.skillName,
          source: "vscode-extension",
          metadata: event.metadata,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        outputChannel.appendLine(
          `Failed to report ${event.action} for ${event.skillName}: ${response.status} ${text}`
        );
      }
    } catch (error) {
      outputChannel.appendLine(
        `Failed to report ${event.action} for ${event.skillName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const treeView = vscode.window.createTreeView("skillsLibrary.tree", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // --- Read-only preview support -----------------------------------------
  // A virtual document scheme lets us open skill content in a normal,
  // read-only-by-convention editor tab without writing a temp file to disk.
  const previewContentProvider = new (class implements vscode.TextDocumentContentProvider {
    private content = new Map<string, string>();

    setContent(uri: vscode.Uri, text: string): void {
      this.content.set(uri.toString(), text);
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
      return this.content.get(uri.toString()) ?? "(content not found — try refreshing)";
    }
  })();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, previewContentProvider)
  );

  // --- Commands ------------------------------------------------------------

  context.subscriptions.push(
    vscode.commands.registerCommand("skillsLibrary.refresh", async () => {
      await treeProvider.reload();
      const err = treeProvider.getLastError();
      if (err) {
        vscode.window.showErrorMessage(`Skills Library: ${err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("skillsLibrary.setSkillsPath", async () => {
      const current = getConfiguredSkillsPath();
      const picked = await vscode.window.showInputBox({
        title: "Skills Library: Set Skills Folder Location",
        prompt: "Absolute path to your skills/ folder",
        value: current,
        placeHolder: "/Users/you/dev/skills",
        validateInput: (value) => (value.trim().length === 0 ? "Path cannot be empty" : undefined),
      });
      if (picked === undefined) {
        return; // user cancelled
      }
      await vscode.workspace
        .getConfiguration("skillsLibrary")
        .update("skillsPath", picked.trim(), vscode.ConfigurationTarget.Global);
      await treeProvider.reload();
      const err = treeProvider.getLastError();
      if (err) {
        vscode.window.showErrorMessage(`Skills Library: ${err}`);
      } else {
        vscode.window.showInformationMessage(
          `Skills Library: found ${treeProvider.getSkillCount()} skill(s).`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("skillsLibrary.preview", async (node: SkillTreeNode) => {
      let title: string;
      let text: string;

      if (node.kind === "skill") {
        title = `${node.skill.name}/SKILL.md`;
        text = await (await import("node:fs/promises")).readFile(node.skill.skillMdPath, "utf-8");
      } else {
        title = `${node.skillName}/references/${node.fileName}`;
        text = await (await import("node:fs/promises")).readFile(node.filePath, "utf-8");
      }

      const uri = vscode.Uri.parse(`${PREVIEW_SCHEME}:/${encodeURIComponent(title)}.md`);
      previewContentProvider.setContent(uri, text);

      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: true });

      await reportSkillEvent({
        action: "skill:preview",
        skillName: node.kind === "skill" ? node.skill.name : node.skillName,
        metadata: { filePath: title, source: "vscode-extension" },
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "skillsLibrary.insert",
      async (node?: SkillTreeNode | SkillInfo) => {
        const skill = await resolveSkillForInsert(node, treeProvider);
        if (!skill) {
          return; // user cancelled the picker, or there was nothing to insert
        }

        const editor = lastActiveTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage(
            "Skills Library: open a file and place your cursor where you'd like to insert, then try again."
          );
          return;
        }

        const content = await getFullSkillContent(skill);
        await editor.edit((editBuilder) => {
          editBuilder.insert(editor.selection.active, content);
        });
        await reportSkillEvent({
          action: "skill:use",
          skillName: skill.name,
          metadata: {
            targetFile: editor.document.uri.fsPath,
            source: "vscode-extension",
          },
        });
        vscode.window.showInformationMessage(`Inserted "${skill.name}" skill content.`);
      }
    )
  );

  // Initial load, plus a watcher so external edits (e.g. adding a 7th skill
  // folder on disk, or editing a SKILL.md in another tool) are picked up
  // automatically rather than requiring a manual refresh every time.
  treeProvider.reload().then(() => {
    const err = treeProvider.getLastError();
    if (err) {
      vscode.window.showErrorMessage(`Skills Library: ${err}`);
    }
  });

  const skillsPath = getConfiguredSkillsPath();
  if (skillsPath) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(skillsPath), "**/*")
    );
    const pendingEvents = new Map<string, NodeJS.Timeout>();
    const onChange = (uri: vscode.Uri) => {
      treeProvider.reload();
      const event = getSkillFileEvent(skillsPath, uri);
      if (!event) {
        return;
      }

      const key = `${event.skillName}:${event.metadata?.filePath ?? uri.fsPath}`;
      const existing = pendingEvents.get(key);
      if (existing) {
        clearTimeout(existing);
      }
      pendingEvents.set(
        key,
        setTimeout(() => {
          pendingEvents.delete(key);
          reportSkillEvent(event);
        }, 750)
      );
    };
    watcher.onDidCreate(onChange);
    watcher.onDidDelete(onChange);
    watcher.onDidChange(onChange);
    context.subscriptions.push(watcher);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("skillsLibrary.skillsPath")) {
        treeProvider.reload();
      }
    })
  );
}

/**
 * The Insert command can be invoked three ways: from the tree item's inline
 * icon (node is a SkillTreeNode), from the command palette with nothing
 * selected (node is undefined, so show a quick-pick), or in principle
 * programmatically with a SkillInfo directly. This normalizes all three into
 * a single SkillInfo to insert.
 */
async function resolveSkillForInsert(
  node: SkillTreeNode | SkillInfo | undefined,
  treeProvider: SkillsTreeDataProvider
): Promise<SkillInfo | undefined> {
  if (node && "kind" in node) {
    if (node.kind === "skill") {
      return node.skill;
    }
    // Insert was somehow invoked on a reference-file node; insert always
    // operates at the skill level, so resolve up to that file's parent skill.
    return treeProvider.getSkillByName(node.skillName);
  }
  if (node && "skillMdPath" in node) {
    return node; // already a SkillInfo
  }

  // No node — command palette invocation. Show a quick-pick of all skills.
  const skillsPath = vscode.workspace
    .getConfiguration("skillsLibrary")
    .get<string>("skillsPath", "");
  if (!skillsPath) {
    vscode.window.showWarningMessage(
      'Skills Library: no skills folder configured yet. Run "Skills: Set Skills Folder Location" first.'
    );
    return undefined;
  }

  const skills = await discoverSkills(skillsPath);
  if (skills.length === 0) {
    vscode.window.showWarningMessage("Skills Library: no skills found in the configured folder.");
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    skills.map((s) => ({
      label: s.name,
      description: s.description.slice(0, 80),
      skill: s,
    })),
    { title: "Insert which skill?", matchOnDescription: true }
  );
  return picked?.skill;
}

export function deactivate(): void {
  // No explicit cleanup needed — everything of note is registered via
  // context.subscriptions in activate() and VS Code disposes those
  // automatically on deactivation.
}
