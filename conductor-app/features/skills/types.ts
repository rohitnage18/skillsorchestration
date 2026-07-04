export type SkillType = "HTTP" | "SERVER_FUNCTION";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RegistrySkill = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  type: SkillType;
  endpointUrl: string | null;
  method: HttpMethod | null;
  headers: unknown;
  functionKey: string | null;
  inputSchema: unknown;
  outputSchema: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};
