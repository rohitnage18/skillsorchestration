import { db } from "../../lib/db";
import { Prisma } from "../../lib/generated/prisma/client";
import { CreateSkillInput, UpdateSkillInput } from "./schemas";
import { runServerFunctionSkill } from "./server-functions";
import { logAction } from "../logging/server-functions";

const DEFAULT_OWNER_ID = "dev-user";
const DEFAULT_OWNER_EMAIL = "dev-user@local.conductor";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getOwnerId(headers: Headers) {
  return headers.get("x-user-id")?.trim() || DEFAULT_OWNER_ID;
}

async function ensureUser(ownerId: string) {
  return db.user.upsert({
    where: { id: ownerId },
    update: {},
    create: {
      id: ownerId,
      email: ownerId === DEFAULT_OWNER_ID ? DEFAULT_OWNER_EMAIL : `${ownerId}@local.conductor`,
    },
  });
}

export async function listRegistrySkills(ownerId: string, query = "") {
  await ensureUser(ownerId);

  const search = query.trim();

  return db.skill.findMany({
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

  const skill = await db.skill.findFirst({
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

  const slug = input.slug ?? slugify(input.name);

  if (!slug) {
    throw new Error("A valid slug is required.");
  }

  const createdSkill = await db.skill.create({
    data: {
      ownerId,
      name: input.name,
      slug,
      description: input.description,
      type: input.type,
      endpointUrl: input.endpointUrl,
      method: input.type === "HTTP" ? input.method ?? "POST" : null,
      headers: (input.headers ?? {}) as Prisma.InputJsonValue,
      functionKey: input.functionKey,
      inputSchema: input.inputSchema as Prisma.InputJsonValue,
      outputSchema: input.outputSchema as Prisma.InputJsonValue,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  await logAction({
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

  const updatedSkill = await db.skill.update({
    where: { id: existing.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.endpointUrl !== undefined ? { endpointUrl: input.endpointUrl } : {}),
      ...(input.method !== undefined ? { method: input.method } : {}),
      ...(input.headers !== undefined ? { headers: input.headers as Prisma.InputJsonValue } : {}),
      ...(input.functionKey !== undefined ? { functionKey: input.functionKey } : {}),
      ...(input.inputSchema !== undefined ? { inputSchema: input.inputSchema as Prisma.InputJsonValue } : {}),
      ...(input.outputSchema !== undefined ? { outputSchema: input.outputSchema as Prisma.InputJsonValue } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
    },
  });

  await logAction({
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
  await db.skill.delete({ where: { id: existing.id } });

  await logAction({
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

  if (skill.type === "SERVER_FUNCTION") {
    if (!skill.functionKey) {
      throw new Error("Skill is missing functionKey.");
    }

    return {
      skillId: skill.id,
      output: await runServerFunctionSkill(skill.functionKey, input),
    };
  }

  if (!skill.endpointUrl) {
    throw new Error("Skill is missing endpointUrl.");
  }

  const response = await fetch(skill.endpointUrl, {
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

  return {
    skillId: skill.id,
    output,
  };
}
