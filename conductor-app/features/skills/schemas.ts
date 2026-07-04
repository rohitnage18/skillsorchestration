import { z } from "zod";

export const skillTypeSchema = z.enum(["HTTP", "SERVER_FUNCTION"]);
export const httpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const jsonObjectSchema = z.record(z.string(), z.unknown());

const baseSkillSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.")
    .optional(),
  description: z.string().trim().max(500).optional(),
  type: skillTypeSchema,
  endpointUrl: z.string().url().optional(),
  method: httpMethodSchema.optional(),
  headers: jsonObjectSchema.optional(),
  functionKey: z.string().trim().min(1).max(120).optional(),
  inputSchema: jsonObjectSchema.default({ type: "object", additionalProperties: true }),
  outputSchema: jsonObjectSchema.default({ type: "object", additionalProperties: true }),
  metadata: jsonObjectSchema.optional(),
});

function validateSkillTarget(value: z.infer<typeof baseSkillSchema>, context: z.RefinementCtx) {
    if (value.type === "HTTP" && !value.endpointUrl) {
      context.addIssue({
        code: "custom",
        path: ["endpointUrl"],
        message: "HTTP skills require an endpointUrl.",
      });
    }

    if (value.type === "SERVER_FUNCTION" && !value.functionKey) {
      context.addIssue({
        code: "custom",
        path: ["functionKey"],
        message: "Server function skills require a functionKey.",
      });
    }
}

export const createSkillSchema = baseSkillSchema.superRefine(validateSkillTarget);

export const updateSkillSchema = baseSkillSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required.",
});

export const executeSkillSchema = z.object({
  input: z.unknown().default({}),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
export type ExecuteSkillInput = z.infer<typeof executeSkillSchema>;
