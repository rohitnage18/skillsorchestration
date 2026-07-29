import { z } from "zod";
import { createSkill, importSkill, installSkillForClient, saveFile } from "./skillStorage.js";
import {
  descriptionSchema,
  editableSkillPathSchema,
  skillFileContentSchema,
  skillNameSchema,
} from "./inputSafety.js";

const skillChangeRequestTestHooks = {
  db: null,
  logAction: null,
  applyChange: null,
};

async function getSkillChangeDb() {
  if (skillChangeRequestTestHooks.db) {
    return skillChangeRequestTestHooks.db;
  }

  return (await import("./db.ts")).db;
}

async function getSkillChangeLogger() {
  if (skillChangeRequestTestHooks.logAction) {
    return skillChangeRequestTestHooks.logAction;
  }

  return (await import("../features/logging/server-functions")).logAction;
}

export const skillChangeRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SKILL_CREATE"),
    skillName: skillNameSchema,
    description: descriptionSchema,
    role: z.string().trim().max(120).optional(),
    owner: z.string().trim().max(120).optional(),
    reviewer: z.string().trim().max(120).optional(),
    qualityStatus: z.enum(["draft", "reviewed", "production-ready"]).optional(),
    triggerDescription: z.string().trim().max(240).optional(),
    tags: z.array(z.string().trim().max(40)).max(12).optional(),
    starterReferences: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(120),
          summary: z.string().trim().max(240).optional(),
        })
      )
      .max(8)
      .optional(),
  }),
  z.object({
    type: z.literal("SKILL_IMPORT"),
    skillName: skillNameSchema,
    targetName: skillNameSchema,
    client: z.enum(["workspace", "codex", "claude-code"]).default("workspace"),
  }),
  z.object({
    type: z.literal("SKILL_FILE_UPDATE"),
    skillName: skillNameSchema,
    path: editableSkillPathSchema,
    content: skillFileContentSchema,
  }),
]);

const rejectRequestSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export function parseSkillChangeRequest(input) {
  return skillChangeRequestSchema.parse(input);
}

export function parseRejectRequest(input) {
  return rejectRequestSchema.parse(input);
}

export async function createSkillChangeRequest(requestedById, input) {
  const payload = parseSkillChangeRequest(input);
  const resourceId = getResourceId(payload);
  const database = await getSkillChangeDb();
  const auditLogger = await getSkillChangeLogger();

  const request = await database.skillChangeRequest.create({
    data: {
      requestedById,
      type: payload.type,
      resourceId,
      payload,
    },
    include: {
      requestedBy: { select: { id: true, email: true, name: true, role: true } },
      reviewedBy: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  await auditLogger({
    userId: requestedById,
    action: "skill-change:request",
    resource: "skill_change_request",
    resourceId: request.id,
    changes: { after: { type: request.type, status: request.status, resourceId } },
    metadata: {
      requestId: request.id,
      requestType: request.type,
      skillName: payload.skillName,
      source: "approval-flow",
    },
  });

  return request;
}

export async function listSkillChangeRequests(user) {
  const isAdmin = user.role === "ADMIN";
  const database = await getSkillChangeDb();
  return database.skillChangeRequest.findMany({
    where: isAdmin ? {} : { requestedById: user.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      requestedBy: { select: { id: true, email: true, name: true, role: true } },
      reviewedBy: { select: { id: true, email: true, name: true, role: true } },
    },
    take: 100,
  });
}

export async function approveSkillChangeRequest(requestId, reviewerId) {
  const database = await getSkillChangeDb();
  const auditLogger = await getSkillChangeLogger();
  const request = await claimPendingRequest(requestId, reviewerId, database);
  const applyChange = skillChangeRequestTestHooks.applyChange ?? applySkillChangeRequest;
  let result;

  try {
    result = await applyChange(request, reviewerId);
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : "Skill change application failed.";
    await database.skillChangeRequest.updateMany({
      where: {
        id: request.id,
        status: "APPLYING",
        reviewedById: reviewerId,
      },
      data: {
        status: "FAILED",
        reviewedAt: new Date(),
        result: { error: { message: failureMessage } },
      },
    });

    await auditLogger({
      userId: reviewerId,
      action: "skill-change:fail",
      resource: "skill_change_request",
      resourceId: request.id,
      changes: { before: { status: "APPLYING" }, after: { status: "FAILED" } },
      metadata: {
        requestId: request.id,
        requestType: request.type,
        requestedById: request.requestedById,
        source: "approval-flow",
        error: failureMessage,
      },
    });
    throw error;
  }

  const finalized = await database.skillChangeRequest.updateMany({
    where: {
      id: request.id,
      status: "APPLYING",
      reviewedById: reviewerId,
    },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      result,
    },
  });

  if (finalized.count !== 1) {
    throw reviewConflictError();
  }

  const updated = await getRequestWithReviewers(request.id, database);

  await auditLogger({
    userId: reviewerId,
    action: "skill-change:approve",
    resource: "skill_change_request",
    resourceId: request.id,
    changes: { before: { status: "PENDING" }, after: { status: "APPROVED", result } },
    metadata: {
      requestId: request.id,
      requestType: request.type,
      requestedById: request.requestedById,
      source: "approval-flow",
    },
  });

  return updated;
}

export async function rejectSkillChangeRequest(requestId, reviewerId, input = {}) {
  const database = await getSkillChangeDb();
  const auditLogger = await getSkillChangeLogger();
  const { reason } = parseRejectRequest(input);

  const rejected = await database.skillChangeRequest.updateMany({
    where: {
      id: requestId,
      status: "PENDING",
    },
    data: {
      status: "REJECTED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: reason || null,
    },
  });

  if (rejected.count !== 1) {
    await throwReviewUnavailable(requestId, database);
  }

  const updated = await getRequestWithReviewers(requestId, database);

  await auditLogger({
    userId: reviewerId,
    action: "skill-change:reject",
    resource: "skill_change_request",
    resourceId: updated.id,
    changes: { before: { status: "PENDING" }, after: { status: "REJECTED", reason: reason || null } },
    metadata: {
      requestId: updated.id,
      requestType: updated.type,
      requestedById: updated.requestedById,
      source: "approval-flow",
    },
  });

  return updated;
}

async function claimPendingRequest(requestId, reviewerId, database) {
  const claimed = await database.skillChangeRequest.updateMany({
    where: {
      id: requestId,
      status: "PENDING",
    },
    data: {
      status: "APPLYING",
      reviewedById: reviewerId,
    },
  });

  if (claimed.count !== 1) {
    await throwReviewUnavailable(requestId, database);
  }

  const request = await database.skillChangeRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    const error = new Error("Skill change request not found after it was claimed.");
    error.status = 409;
    throw error;
  }

  return request;
}

async function throwReviewUnavailable(requestId, database) {
  const request = await database.skillChangeRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    const error = new Error("Skill change request not found.");
    error.status = 404;
    throw error;
  }

  throw reviewConflictError();
}

function reviewConflictError() {
  const error = new Error("Only pending requests can be reviewed.");
  error.status = 409;
  return error;
}

async function getRequestWithReviewers(requestId, database) {
  return database.skillChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      requestedBy: { select: { id: true, email: true, name: true, role: true } },
      reviewedBy: { select: { id: true, email: true, name: true, role: true } },
    },
  });
}

async function applySkillChangeRequest(request, reviewerId) {
  const payload = parseSkillChangeRequest(request.payload);

  if (payload.type === "SKILL_CREATE") {
    const skillName = await createSkill(payload.skillName, payload.description || "New skill", reviewerId, {
      role: payload.role,
      owner: payload.owner,
      reviewer: payload.reviewer,
      qualityStatus: payload.qualityStatus,
      triggerDescription: payload.triggerDescription,
      tags: payload.tags,
      starterReferences: payload.starterReferences,
    });
    return { skillName };
  }

  if (payload.type === "SKILL_IMPORT") {
    if (payload.client === "workspace") {
      const path = await importSkill(payload.skillName, payload.targetName, reviewerId);
      return { client: payload.client, path };
    }
    return await installSkillForClient(payload.skillName, payload.client, reviewerId);
  }

  if (payload.type === "SKILL_FILE_UPDATE") {
    await saveFile(payload.skillName, payload.path, payload.content, reviewerId);
    return { skillName: payload.skillName, path: payload.path };
  }

  throw new Error(`Unsupported request type: ${request.type}`);
}

function getResourceId(payload) {
  if (payload.type === "SKILL_FILE_UPDATE") {
    return `${payload.skillName}:${payload.path}`;
  }

  if (payload.type === "SKILL_IMPORT") {
    return `${payload.client}:${payload.skillName}:${payload.targetName}`;
  }

  return payload.skillName;
}

export function __setSkillChangeRequestTestHooks(hooks = {}) {
  skillChangeRequestTestHooks.db = hooks.db ?? null;
  skillChangeRequestTestHooks.logAction = hooks.logAction ?? null;
  skillChangeRequestTestHooks.applyChange = hooks.applyChange ?? null;
}
