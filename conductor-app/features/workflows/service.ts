import { Prisma } from "../../lib/generated/prisma/client";
import { db } from "../../lib/db";
import { getOwnerId } from "../skills/service";
import { CreateWorkflowInput, UpdateWorkflowInput } from "./schemas";
import { logAction } from "../logging/server-functions";

async function ensureWorkflowOwner(ownerId: string) {
  await db.user.upsert({
    where: { id: ownerId },
    update: {},
    create: {
      id: ownerId,
      email: `${ownerId}@local.conductor`,
    },
  });
}

export { getOwnerId };

export async function listWorkflows(ownerId: string) {
  await ensureWorkflowOwner(ownerId);

  return db.workflow.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getWorkflow(ownerId: string, workflowId: string) {
  await ensureWorkflowOwner(ownerId);

  const workflow = await db.workflow.findFirst({
    where: { id: workflowId, ownerId },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { nodeRuns: true },
      },
    },
  });

  if (!workflow) {
    throw new Error("Workflow not found.");
  }

  return workflow;
}

export async function createWorkflow(ownerId: string, input: CreateWorkflowInput) {
  await ensureWorkflowOwner(ownerId);

  const createdWorkflow = await db.workflow.create({
    data: {
      ownerId,
      name: input.name,
      description: input.description,
      definition: input.definition as Prisma.InputJsonValue,
    },
  });

  await logAction({
    userId: ownerId,
    action: "workflow:create",
    resource: "workflow",
    resourceId: createdWorkflow.id,
    changes: { after: createdWorkflow },
    metadata: { ownerId },
  });

  return createdWorkflow;
}

export async function updateWorkflow(ownerId: string, workflowId: string, input: UpdateWorkflowInput) {
  const workflow = await getWorkflow(ownerId, workflowId);

  const updatedWorkflow = await db.workflow.update({
    where: { id: workflow.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.definition ? { definition: input.definition as Prisma.InputJsonValue } : {}),
      version: { increment: 1 },
    },
  });

  await logAction({
    userId: ownerId,
    action: "workflow:update",
    resource: "workflow",
    resourceId: workflow.id,
    changes: { before: workflow, after: updatedWorkflow },
    metadata: { ownerId },
  });

  return updatedWorkflow;
}

export async function deleteWorkflow(ownerId: string, workflowId: string) {
  const workflow = await getWorkflow(ownerId, workflowId);
  await db.workflow.delete({ where: { id: workflow.id } });

  await logAction({
    userId: ownerId,
    action: "workflow:delete",
    resource: "workflow",
    resourceId: workflow.id,
    changes: { before: workflow },
    metadata: { ownerId },
  });

  return { deleted: true, id: workflow.id };
}
