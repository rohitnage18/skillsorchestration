import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const repoRoot = path.resolve(process.cwd(), "..");

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with E2E OAuth simulator" }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(
    page.getByRole("heading", { name: "Govern your skill operations from one clear view." })
  ).toBeVisible();
}

test("OAuth session gates private skill APIs", async ({ page }) => {
  const unauthenticated = await page.request.get("/api/skills");
  expect(unauthenticated.status()).toBe(401);

  await signInAsAdmin(page);
  const authenticated = await page.request.get("/api/skills");
  const authenticatedBody = await authenticated.json();
  expect(authenticated.ok(), JSON.stringify(authenticatedBody)).toBeTruthy();
  expect(Array.isArray(authenticatedBody)).toBeTruthy();
});

test("admin can invite and disable a user", async ({ page }) => {
  await signInAsAdmin(page);
  const email = `e2e-member-${Date.now()}@example.com`;

  await page.getByLabel("Work email *").fill(email);
  await page.getByLabel("Display name").fill("E2E Member");
  await page.getByLabel("Working branch", { exact: true }).fill(`users/e2e-${Date.now()}`);
  await page.getByRole("button", { name: "Add user" }).click();
  await expect(page.getByRole("status")).toContainText(`${email} is ready to join`);

  const usersResponse = await page.request.get("/api/users");
  const users = (await usersResponse.json()).data as Array<{
    id: string;
    email: string;
    name: string | null;
    role: "ADMIN" | "USER";
    status: string;
    preferredBranch: string | null;
  }>;
  const created = users.find((user) => user.email === email);
  if (!created) throw new Error("Invited E2E user was not returned by the users API.");
  expect(created.status).toBe("INVITED");

  const disableResponse = await page.request.post("/api/users", {
    data: {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      status: "DISABLED",
      preferredBranch: created.preferredBranch,
    },
  });
  expect(disableResponse.ok()).toBeTruthy();
  expect((await disableResponse.json()).data.status).toBe("DISABLED");
});

test("admin approval applies a pending skill change", async ({ page }) => {
  const skillName = `e2e-approval-${Date.now()}`;
  const skillDir = path.join(repoRoot, "skills", skillName);
  const skillFile = path.join(skillDir, "SKILL.md");
  const original = `---\nname: ${skillName}\ndescription: E2E approval fixture.\n---\n\n# Original\n`;
  const updated = `---\nname: ${skillName}\ndescription: E2E approval fixture.\n---\n\n# Approved\n`;
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(skillFile, original, "utf-8");

  try {
    await signInAsAdmin(page);
    const createResponse = await page.request.post("/api/skill-change-requests", {
      data: { type: "SKILL_FILE_UPDATE", skillName, path: "SKILL.md", content: updated },
    });
    expect(createResponse.status()).toBe(201);

    await page.goto("/admin");
    const approvalRow = page.locator(".admin-row", { hasText: `Update ${skillName}/SKILL.md` });
    await expect(approvalRow).toBeVisible();
    await approvalRow.getByRole("button", { name: "Approve" }).click();
    await expect(page.locator(".admin-row", { hasText: `Update ${skillName}/SKILL.md` }).first()).toBeVisible();

    const requestsResponse = await page.request.get("/api/skill-change-requests");
    const requests = (await requestsResponse.json()).data as Array<{
      status: string;
      payload: { skillName?: string };
    }>;
    const approvedRequest = requests.find((request) => request.payload.skillName === skillName);
    if (!approvedRequest) throw new Error("Approved E2E request was not returned by the API.");
    expect(approvedRequest.status).toBe("APPROVED");
    expect(fs.readFileSync(skillFile, "utf-8")).toBe(updated);
  } finally {
    fs.rmSync(skillDir, { recursive: true, force: true });
    fs.rmSync(path.join(process.cwd(), "data", "skill-versions", skillName), { recursive: true, force: true });
  }
});

test("workflow UI creates and executes a workflow", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/workflows");

  const workflowName = `E2E workflow ${Date.now()}`;
  const definition = {
    nodes: [
      { id: "input", type: "input" },
      { id: "transform", type: "transform", config: { output: { source: "e2e" } } },
      { id: "output", type: "output" },
    ],
    edges: [
      { id: "input-transform", source: "input", target: "transform" },
      { id: "transform-output", source: "transform", target: "output" },
    ],
  };

  await page.getByLabel("Name").fill(workflowName);
  await page.getByLabel("Definition JSON").fill(JSON.stringify(definition));
  await page.getByRole("button", { name: "Create workflow" }).click();
  await expect(page.getByRole("option", { name: workflowName })).toBeAttached();

  await page.getByLabel("Workflow", { exact: true }).selectOption({ label: workflowName });
  await page.getByLabel("Input JSON", { exact: true }).fill(JSON.stringify({ message: "hello" }));

  const executionResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/workflows\/[^/]+\/execute$/.test(new URL(response.url()).pathname),
    { timeout: 30_000 }
  );
  await page.getByRole("button", { name: "Execute workflow" }).click();
  const executionResponse = await executionResponsePromise;
  const executionBody = await executionResponse.json();
  expect(executionResponse.ok(), JSON.stringify(executionBody)).toBeTruthy();
  expect(executionBody.status).toBe("SUCCEEDED");
  await expect(page.locator(".result-pre")).toContainText('"status": "SUCCEEDED"', {
    timeout: 10_000,
  });

  const workflows = (await (await page.request.get("/api/workflows")).json()) as Array<{
    id: string;
    name: string;
  }>;
  const workflow = workflows.find((item) => item.name === workflowName);
  if (!workflow) throw new Error("Created E2E workflow was not returned by the API.");
  expect((await page.request.delete(`/api/workflows/${workflow.id}`)).ok()).toBeTruthy();
});
