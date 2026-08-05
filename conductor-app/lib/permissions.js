export const rolePermissions = Object.freeze({
  ADMIN: Object.freeze([
    "audit_logs:read",
    "audit_logs:write",
    "audit_logs:purge",
    "imports:manage",
    "notifications:manage",
    "notifications:resend",
    "registry_skills:manage",
    "skill_change_requests:review",
    "skills:manage",
    "skills:use",
    "users:manage",
    "workflows:manage",
    "workflows:use",
  ]),
  USER: Object.freeze([
    "notifications:read",
    "skill_change_requests:create",
    "skills:use",
    "workflows:use",
  ]),
});

export function roleHasPermission(role, permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}
