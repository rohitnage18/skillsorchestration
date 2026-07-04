export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown, fallbackMessage: string, status = 500) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return jsonResponse({ error: message }, status);
}
