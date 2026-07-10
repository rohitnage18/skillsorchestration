import { db } from "./db";
import { auth } from "../auth.js";

export async function getRequestUserId(headers) {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  if (process.env.ALLOW_HEADER_AUTH === "true") {
    return headers.get("x-user-id")?.trim() || "";
  }

  return "";
}

export async function getRequestUser(headers) {
  const userId = await getRequestUserId(headers);
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
