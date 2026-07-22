import { ZodError } from "zod";

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown, fallbackMessage: string, status = 500) {
  if (status >= 500) {
    console.error(fallbackMessage, error);
    return jsonResponse({ error: fallbackMessage }, status);
  }

  const message = error instanceof ZodError
    ? "Invalid request data."
    : error instanceof Error
      ? error.message
      : fallbackMessage;
  return jsonResponse({ error: message }, status);
}
