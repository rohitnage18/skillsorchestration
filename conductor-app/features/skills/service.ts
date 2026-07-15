import type { CreateSkillInput, UpdateSkillInput } from "./schemas";

const registryServiceTestHooks: {
  db?: any;
  logAction?: (...args: any[]) => any;
  requireUser?: (...args: any[]) => any;
  runServerFunctionSkill?: (...args: any[]) => any;
  fetch?: typeof fetch;
} = {};

async function getDatabase() {
  if (registryServiceTestHooks.db) {
    return registryServiceTestHooks.db;
  }

  return (await import("../../lib/db")).db;
}

async function getLogAction() {
  if (registryServiceTestHooks.logAction) {
    return registryServiceTestHooks.logAction;
  }

  return (await import("../logging/server-functions")).logAction;
}

async function getRequireUser() {
  if (registryServiceTestHooks.requireUser) {
    return registryServiceTestHooks.requireUser;
  }

  return (await import("../../lib/auth.js")).requireUser;
}

async function getRunServerFunctionSkill() {
  if (registryServiceTestHooks.runServerFunctionSkill) {
    return registryServiceTestHooks.runServerFunctionSkill;
  }

  return (await import("./server-functions")).runServerFunctionSkill;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getOwnerId(headers: Headers) {
  const user = await (await getRequireUser())(headers);
  return user.id;
}

async function ensureUser(ownerId: string) {
  const database = await getDatabase();
  return database.user.upsert({
    where: { id: ownerId },
    update: {},
    create: {
      id: ownerId,
      email: `${ownerId}@local.conductor`,
    },
  });
}

export async function listRegistrySkills(ownerId: string, query = "") {
  await ensureUser(ownerId);
  const database = await getDatabase();

  const search = query.trim();

  return database.skill.findMany({
    where: {
      ownerId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getRegistrySkill(ownerId: string, skillId: string) {
  await ensureUser(ownerId);
  const database = await getDatabase();

  const skill = await database.skill.findFirst({
    where: {
      ownerId,
      OR: [{ id: skillId }, { slug: skillId }],
    },
  });

  if (!skill) {
    throw new Error("Skill not found.");
  }

  return skill;
}

export async function createRegistrySkill(ownerId: string, input: CreateSkillInput) {
  await ensureUser(ownerId);
  const database = await getDatabase();

  const slug = input.slug ?? slugify(input.name);

  if (!slug) {
    throw new Error("A valid slug is required.");
  }

  const createdSkill = await database.skill.create({
    data: {
      ownerId,
      name: input.name,
      slug,
      description: input.description,
      type: input.type,
      endpointUrl: input.endpointUrl,
      method: input.type === "HTTP" ? input.method ?? "POST" : null,
      headers: (input.headers ?? {}) as any,
      functionKey: input.functionKey,
      inputSchema: input.inputSchema as any,
      outputSchema: input.outputSchema as any,
      metadata: (input.metadata ?? {}) as any,
    },
  });

  await (await getLogAction())({
    userId: ownerId,
    action: "skill:create",
    resource: "skill",
    resourceId: createdSkill.id,
    changes: { after: createdSkill },
    metadata: { ownerId },
  });

  return createdSkill;
}

export async function updateRegistrySkill(ownerId: string, skillId: string, input: UpdateSkillInput) {
  const existing = await getRegistrySkill(ownerId, skillId);
  const database = await getDatabase();

  const updatedSkill = await database.skill.update({
    where: { id: existing.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.endpointUrl !== undefined ? { endpointUrl: input.endpointUrl } : {}),
      ...(input.method !== undefined ? { method: input.method } : {}),
      ...(input.headers !== undefined ? { headers: input.headers as any } : {}),
      ...(input.functionKey !== undefined ? { functionKey: input.functionKey } : {}),
      ...(input.inputSchema !== undefined ? { inputSchema: input.inputSchema as any } : {}),
      ...(input.outputSchema !== undefined ? { outputSchema: input.outputSchema as any } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata as any } : {}),
    },
  });

  await (await getLogAction())({
    userId: ownerId,
    action: "skill:update",
    resource: "skill",
    resourceId: existing.id,
    changes: { before: existing, after: updatedSkill },
    metadata: { ownerId },
  });

  return updatedSkill;
}

export async function deleteRegistrySkill(ownerId: string, skillId: string) {
  const existing = await getRegistrySkill(ownerId, skillId);
  const database = await getDatabase();
  await database.skill.delete({ where: { id: existing.id } });

  await (await getLogAction())({
    userId: ownerId,
    action: "skill:delete",
    resource: "skill",
    resourceId: existing.id,
    changes: { before: existing },
    metadata: { ownerId },
  });

  return { deleted: true, id: existing.id };
}

export async function executeRegistrySkill(ownerId: string, skillId: string, input: unknown) {
  const skill = await getRegistrySkill(ownerId, skillId);

  try {
    if (skill.type === "SERVER_FUNCTION") {
      if (!skill.functionKey) {
        throw new Error("Skill is missing functionKey.");
      }

      const result = {
        skillId: skill.id,
        output: await (await getRunServerFunctionSkill())(skill.functionKey, input),
      };

      await (await getLogAction())({
        userId: ownerId,
        action: "skill:execute",
        resource: "skill",
        resourceId: skill.id,
        metadata: { ownerId, skillName: skill.name, source: "registry" },
      });

      return result;
    }

    if (!skill.endpointUrl) {
      throw new Error("Skill is missing endpointUrl.");
    }

    const response = await (registryServiceTestHooks.fetch ?? fetch)(skill.endpointUrl, {
      method: skill.method ?? "POST",
      headers: {
        "content-type": "application/json",
        ...((skill.headers as Record<string, string> | null) ?? {}),
      },
      body: ["GET", "DELETE"].includes(skill.method ?? "") ? undefined : JSON.stringify(input),
    });

    const text = await response.text();
    const output = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(`Skill endpoint failed with ${response.status}: ${text}`);
    }

    const result = {
      skillId: skill.id,
      output,
    };

    await (await getLogAction())({
      userId: ownerId,
      action: "skill:execute",
      resource: "skill",
      resourceId: skill.id,
      metadata: { ownerId, skillName: skill.name, source: "registry" },
    });

    return result;
  } catch (error) {
    await (await getLogAction())({
      userId: ownerId,
      action: "skill:execute:fail",
      resource: "skill",
      resourceId: skill.id,
      metadata: {
        ownerId,
        skillName: skill.name,
        source: "registry",
        error: error instanceof Error ? error.message : "Skill execution failed.",
      },
    });
    throw error;
  }
}

export function __setRegistryServiceTestHooks(hooks: typeof registryServiceTestHooks = {}) {
  registryServiceTestHooks.db = hooks.db;
  registryServiceTestHooks.logAction = hooks.logAction;
  registryServiceTestHooks.requireUser = hooks.requireUser;
  registryServiceTestHooks.runServerFunctionSkill = hooks.runServerFunctionSkill;
  registryServiceTestHooks.fetch = hooks.fetch;
}
