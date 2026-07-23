import { db } from "./db";
import { auth } from "../auth.js";

const rolePermissions = {
  ADMIN: [
    "audit_logs:read",
    "audit_logs:write",
    "audit_logs:purge",
    "imports:manage",
    "notifications:manage",
    "notifications:resend",
    "registry_skills:manage",
    "skill_change_requests:review",
    "skills:manage",
    "users:manage",
    "workflows:manage",
    "workflows:use",
  ],
  USER: [
    "notifications:read",
    "skill_change_requests:create",
    "skills:use",
    "workflows:use",
  ],
};

export async function getRequestUserId() {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  return "";
}

export async function getRequestUser(headers) {
  const userId = await getRequestUserId();
  if (!userId) {
    return null;
  }

  return db.user.findUnique({
    where: { id: userId },
  });
}

export async function requireUser(headers) {
  const user = await getRequestUser(headers);
  if (!user) {
    const error = new Error("Login is required.");
    error.status = 401;
    throw error;
  }
  if (user.status !== "ACTIVE") {
    await logInactiveUserAccess(user);
    const error = new Error(
      user.status === "INVITED"
        ? "Your account has been invited but is not active yet."
        : user.status === "PENDING"
          ? "Your account is pending admin approval."
          : "Your account is disabled."
    );
    error.status = 403;
    throw error;
  }
  return user;
}

export async function requireRole(headers, roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  const user = await requireUser(headers);
  if (!allowedRoles.includes(user.role)) {
    await logAuthorizationFailure(user, allowedRoles);
    const error = new Error(`${allowedRoles.join(" or ")} permission is required.`);
    error.status = 403;
    throw error;
  }
  return user;
}

export async function requireAdmin(headers) {
  return requireRole(headers, "ADMIN");
}

export async function requirePermission(headers, permission) {
  const user = await requireUser(headers);
  const grantedPermissions = rolePermissions[user.role] || [];

  if (!grantedPermissions.includes(permission)) {
    await logAuthorizationFailure(user, [permission], "permission");
    const error = new Error(`${permission} permission is required.`);
    error.status = 403;
    throw error;
  }

  return user;
}

export function getErrorStatus(error, fallback = 500) {
  return typeof error?.status === "number" ? error.status : fallback;
}

async function logAuthorizationFailure(user, allowed, mode = "role") {
  try {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "auth:role-denied",
        resource: "authorization",
        resourceId: user.id,
        changes: {
          before: { role: user.role, status: user.status },
          after: mode === "permission" ? { requiredPermissions: allowed } : { requiredRoles: allowed },
        },
        metadata: {
          email: user.email,
          name: user.name,
          deniedMode: mode,
          attemptedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Failed to log authorization failure:", error);
  }
}

async function logInactiveUserAccess(user) {
  try {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "auth:status-denied",
        resource: "authorization",
        resourceId: user.id,
        changes: {
          before: { status: user.status },
          after: { requiredStatus: "ACTIVE" },
        },
        metadata: {
          email: user.email,
          name: user.name,
          attemptedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Failed to log inactive user access:", error);
  }
}
