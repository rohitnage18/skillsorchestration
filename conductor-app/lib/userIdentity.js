import { db } from "./db";

export async function resolveExternalEventUser({ externalUserId, email, name }) {
  const normalizedExternalUserId = String(externalUserId || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(name || "").trim();

  if (!normalizedExternalUserId || !normalizedEmail) {
    const error = new Error("External user id and email are required.");
    error.status = 400;
    throw error;
  }

  const [byExternalUserId, byEmail] = await Promise.all([
    db.user.findUnique({ where: { externalUserId: normalizedExternalUserId } }),
    db.user.findUnique({ where: { email: normalizedEmail } }),
  ]);

  if (byExternalUserId && byEmail && byExternalUserId.id !== byEmail.id) {
    const error = new Error("External user identity conflicts with an existing email-owned user.");
    error.status = 409;
    throw error;
  }

  const resolvedUser = byExternalUserId || byEmail;
  if (!resolvedUser) {
    const error = new Error("User must be created and approved by an admin before reporting events.");
    error.status = 403;
    throw error;
  }

  if (resolvedUser.status !== "ACTIVE") {
    const error = new Error(
      resolvedUser.status === "INVITED"
        ? "User has been invited but is not active yet."
        : resolvedUser.status === "PENDING"
          ? "User is pending admin approval."
          : "User is disabled."
    );
    error.status = 403;
    throw error;
  }

  return db.user.update({
    where: { id: resolvedUser.id },
    data: {
      email: normalizedEmail,
      externalUserId: normalizedExternalUserId,
      ...(normalizedName ? { name: normalizedName } : {}),
      lastSeenAt: new Date(),
    },
  });
}
