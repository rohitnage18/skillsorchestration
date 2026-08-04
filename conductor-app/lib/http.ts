import { ZodError } from "zod";

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function getRouteErrorStatus(error: unknown, validationStatus = 400) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return validationStatus;
  }

  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }

  return 500;
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
