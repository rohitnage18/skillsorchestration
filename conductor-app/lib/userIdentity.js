const IDENTITY_MISMATCH_MESSAGE =
  "External event identity does not match an active user configured by an administrator.";

export async function resolveExternalEventUser(
  { externalUserId, email },
  { database, now = () => new Date() } = {}
) {
  const identityDatabase = database ?? (await import("./db")).db;
  const normalizedExternalUserId = String(externalUserId || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedExternalUserId || !normalizedEmail) {
    const error = new Error("External user id and email are required.");
    error.status = 400;
    throw error;
  }

  const resolvedUser = await identityDatabase.user.findUnique({
    where: { externalUserId: normalizedExternalUserId },
  });

  if (
    !resolvedUser ||
    resolvedUser.status !== "ACTIVE" ||
    String(resolvedUser.email || "").trim().toLowerCase() !== normalizedEmail
  ) {
    throwIdentityMismatch();
  }

  const lastSeenAt = now();
  const result = await identityDatabase.user.updateMany({
    where: {
      id: resolvedUser.id,
      email: resolvedUser.email,
      externalUserId: normalizedExternalUserId,
      status: "ACTIVE",
    },
    data: { lastSeenAt },
  });

  if (result.count !== 1) {
    throwIdentityMismatch();
  }

  return { ...resolvedUser, lastSeenAt };
}

function throwIdentityMismatch() {
  const error = new Error(IDENTITY_MISMATCH_MESSAGE);
  error.status = 403;
  throw error;
}
