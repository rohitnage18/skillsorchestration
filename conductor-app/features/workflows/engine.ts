import { Prisma } from "../../lib/generated/prisma/client";
import { db } from "../../lib/db";
import { executeRegistrySkill } from "../skills/service";
import { WorkflowDefinition, WorkflowEdge, WorkflowNode, workflowDefinitionSchema } from "./schemas";
import { logAction } from "../logging/server-functions";

type ExecutionContext = {
  workflowInput: unknown;
  nodeOutputs: Record<string, unknown>;
};

function getPathValue(source: unknown, path: string) {
  if (!path) return source;

  return path.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, source);
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split(".");
  let cursor = target;

  for (const [index, segment] of segments.entries()) {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }

    if (!cursor[segment] || typeof cursor[segment] !== "object") {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  }
}

function incomingEdges(nodeId: string, edges: WorkflowEdge[]) {
  return edges.filter((edge) => edge.target === nodeId);
}

function outgoingEdges(nodeId: string, edges: WorkflowEdge[]) {
  return edges.filter((edge) => edge.source === nodeId);
}

function validateGraph(definition: WorkflowDefinition) {
  const nodeIds = new Set(definition.nodes.map((node) => node.id));

  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error(`Invalid edge ${edge.id}: source or target node is missing.`);
    }
  }

  for (const node of definition.nodes) {
    if (node.type === "skill" && !node.skillId) {
      throw new Error(`Skill node ${node.id} is missing skillId.`);
    }
  }
}

function topologicalLevels(definition: WorkflowDefinition) {
  const indegree = new Map<string, number>();
  const nodeById = new Map(definition.nodes.map((node) => [node.id, node]));

  for (const node of definition.nodes) {
    indegree.set(node.id, 0);
  }

  for (const edge of definition.edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const levels: WorkflowNode[][] = [];
  let ready = definition.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0);
  let visitedCount = 0;

  while (ready.length > 0) {
    levels.push(ready);
    visitedCount += ready.length;

    const nextReady: WorkflowNode[] = [];
    for (const node of ready) {
      for (const edge of outgoingEdges(node.id, definition.edges)) {
        const nextIndegree = (indegree.get(edge.target) ?? 0) - 1;
        indegree.set(edge.target, nextIndegree);
        if (nextIndegree === 0) {
          const targetNode = nodeById.get(edge.target);
          if (targetNode) nextReady.push(targetNode);
        }
      }
    }

    ready = nextReady;
  }

  if (visitedCount !== definition.nodes.length) {
    throw new Error("Workflow graph contains a cycle.");
  }

  return levels;
}

function resolveNodeInput(node: WorkflowNode, definition: WorkflowDefinition, context: ExecutionContext) {
  if (node.type === "input") {
    return context.workflowInput;
  }

  const configuredInput = (node.config?.input ?? {}) as Record<string, unknown>;
  const input = { ...configuredInput };

  for (const edge of incomingEdges(node.id, definition.edges)) {
    const sourceOutput = context.nodeOutputs[edge.source];

    if (edge.mapping && Object.keys(edge.mapping).length > 0) {
      for (const [targetPath, sourcePath] of Object.entries(edge.mapping)) {
        setPathValue(input, targetPath, getPathValue(sourceOutput, sourcePath));
      }
    } else {
      input[edge.source] = sourceOutput;
    }
  }

  return input;
}

async function runNode(ownerId: string, node: WorkflowNode, definition: WorkflowDefinition, context: ExecutionContext) {
  const input = resolveNodeInput(node, definition, context);

  if (node.type === "input") {
    return input;
  }

  if (node.type === "skill") {
    const result = await executeRegistrySkill(ownerId, node.skillId!, input);
    return result.output;
  }

  if (node.type === "transform") {
    return {
      ...((node.config?.output as Record<string, unknown> | undefined) ?? {}),
      input,
    };
  }

  return input;
}

export async function executeWorkflow(ownerId: string, workflowId: string, input: unknown) {
  const workflow = await db.workflow.findFirst({
    where: { id: workflowId, ownerId },
  });

  if (!workflow) {
    throw new Error("Workflow not found.");
  }

  const definition = workflowDefinitionSchema.parse(workflow.definition);
  validateGraph(definition);

  const run = await db.workflowRun.create({
    data: {
      workflowId: workflow.id,
      userId: ownerId,
      status: "RUNNING",
      input: input as Prisma.InputJsonValue,
      startedAt: new Date(),
    },
  });

  await logAction({
    userId: ownerId,
    action: "workflow:run:start",
    resource: "workflow_run",
    resourceId: run.id,
    metadata: {
      ownerId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      source: "workflow-engine",
    },
  });

  const context: ExecutionContext = {
    workflowInput: input,
    nodeOutputs: {},
  };

  try {
    const levels = topologicalLevels(definition);

    for (const level of levels) {
      await Promise.all(
        level.map(async (node) => {
          const nodeRun = await db.nodeRun.create({
            data: {
              runId: run.id,
              nodeId: node.id,
              skillId: node.skillId,
              status: "RUNNING",
              input: resolveNodeInput(node, definition, context) as Prisma.InputJsonValue,
              startedAt: new Date(),
            },
          });

          try {
            const output = await runNode(ownerId, node, definition, context);
            context.nodeOutputs[node.id] = output;

            await db.nodeRun.update({
              where: { id: nodeRun.id },
              data: {
                status: "SUCCEEDED",
                output: output as Prisma.InputJsonValue,
                completedAt: new Date(),
              },
            });
          } catch (error) {
            await db.nodeRun.update({
              where: { id: nodeRun.id },
              data: {
                status: "FAILED",
                error: { message: error instanceof Error ? error.message : "Node failed." },
                completedAt: new Date(),
              },
            });
            throw error;
          }
        }),
      );
    }

    const outputNode = definition.nodes.find((node) => node.type === "output");
    const output = outputNode ? context.nodeOutputs[outputNode.id] : context.nodeOutputs;

    const completedRun = await db.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        output: output as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
      include: { nodeRuns: true },
    });

    await logAction({
      userId: ownerId,
      action: "workflow:run:complete",
      resource: "workflow_run",
      resourceId: run.id,
      metadata: {
        ownerId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        source: "workflow-engine",
      },
    });

    return completedRun;
  } catch (error) {
    await db.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: { message: error instanceof Error ? error.message : "Workflow failed." },
        completedAt: new Date(),
      },
    });

    await logAction({
      userId: ownerId,
      action: "workflow:run:fail",
      resource: "workflow_run",
      resourceId: run.id,
      metadata: {
        ownerId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        source: "workflow-engine",
        error: error instanceof Error ? error.message : "Workflow failed.",
      },
    });

    throw error;
  }
}
