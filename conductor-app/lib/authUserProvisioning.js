export async function upsertAuthenticatedUser(
  profile,
  { database, adminEmails = new Set(), allowFirstUserAdmin = () => false, now = () => new Date() }
) {
  const email = profile?.email?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  const existingUser = await database.user.findUnique({ where: { email } });
  const lastSeenAt = now();
  const name = profile.name || existingUser?.name || null;

  if (existingUser) {
    return database.user.update({
      where: { id: existingUser.id },
      data: { name, lastSeenAt },
    });
  }

  const userCount = await database.user.count();
  const shouldBeAdmin = adminEmails.has(email) || (userCount === 0 && allowFirstUserAdmin());

  return database.user.upsert({
    where: { email },
    update: { name, lastSeenAt },
    create: {
      email,
      name,
      lastSeenAt,
      role: shouldBeAdmin ? "ADMIN" : "USER",
      status: shouldBeAdmin ? "ACTIVE" : "PENDING",
    },
  });
}
