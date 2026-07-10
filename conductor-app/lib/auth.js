import { db } from "./db";

export function getRequestUserId(headers) {
  return headers.get("x-user-id")?.trim() || "";
}

export async function getRequestUser(headers) {
  const userId = getRequestUserId(headers);
  if (!userId) {
    return null;
  }

  return db.user.findUnique({
    where: { id: userId },
  });
}

export async function requireAdmin(headers) {
  const user = await getRequestUser(headers);
  if (!user || user.role !== "ADMIN") {
    const error = new Error("Admin permission is required.");
    error.status = 403;
    throw error;
  }
  return user;
}

export function getErrorStatus(error, fallback = 500) {
  return typeof error?.status === "number" ? error.status : fallback;
}
