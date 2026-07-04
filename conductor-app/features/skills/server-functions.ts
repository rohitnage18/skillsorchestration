type ServerSkillHandler = (input: unknown) => Promise<unknown> | unknown;

const handlers: Record<string, ServerSkillHandler> = {
  "echo.v1": (input) => ({ input }),
};

export function runServerFunctionSkill(functionKey: string, input: unknown) {
  const handler = handlers[functionKey];

  if (!handler) {
    throw new Error(`Unknown server function skill: ${functionKey}`);
  }

  return handler(input);
}
