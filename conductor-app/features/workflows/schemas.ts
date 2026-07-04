import { z } from "zod";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const workflowNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(["input", "skill", "transform", "output"]),
  skillId: z.string().trim().min(1).optional(),
  config: jsonObjectSchema.optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export const workflowEdgeSchema = z.object({
  id: z.string().trim().min(1),
  source: z.string().trim().min(1),
  target: z.string().trim().min(1),
  mapping: z.record(z.string(), z.string()).optional(),
});

export const workflowDefinitionSchema = z.object({
  nodes: z.array(workflowNodeSchema).min(1),
  edges: z.array(workflowEdgeSchema).default([]),
});

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  definition: workflowDefinitionSchema,
});

export const updateWorkflowSchema = createWorkflowSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required.",
});

export const executeWorkflowSchema = z.object({
  input: z.unknown().default({}),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
