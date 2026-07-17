export function parseEmailConfigFromEnv(env = process.env) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.FROM_EMAIL) {
    return null;
  }

  return {
    smtpHost: env.SMTP_HOST,
    smtpPort: Number(env.SMTP_PORT ?? 587),
    smtpSecure: env.SMTP_SECURE === "true",
    smtpUser: env.SMTP_USER,
    smtpPassword: env.SMTP_PASSWORD,
    fromEmail: env.FROM_EMAIL,
  };
}

export function mapActionToNotificationType(action) {
  const typeMap = {
    "skill:list": "USER_ACTION",
    "skill:read": "USER_ACTION",
    "skill:create": "SKILL_CREATED",
    "skill:update": "SKILL_UPDATED",
    "skill:delete": "SKILL_DELETED",
    "skill:import": "USER_ACTION",
    "skill:preview": "USER_ACTION",
    "skill:use": "USER_ACTION",
    "skill:test": "USER_ACTION",
    "skill:execute": "USER_ACTION",
    "skill:test:fail": "USER_ACTION",
    "skill:execute:fail": "USER_ACTION",
    "skill:file:update": "USER_ACTION",
    "skill:file:restore": "USER_ACTION",
    "context:update": "USER_ACTION",
    "workflow:create": "WORKFLOW_CREATED",
    "workflow:update": "WORKFLOW_UPDATED",
    "workflow:delete": "WORKFLOW_DELETED",
    "workflow:run:start": "WORKFLOW_RUN_STARTED",
    "workflow:run:complete": "WORKFLOW_RUN_COMPLETED",
    "workflow:run:fail": "WORKFLOW_RUN_FAILED",
    "skill-change:request": "USER_ACTION",
    "skill-change:approve": "USER_ACTION",
    "skill-change:reject": "USER_ACTION",
    "user:role:update": "USER_ACTION",
    "user:branch:update": "USER_ACTION",
    "user:external-id:update": "USER_ACTION",
    "user:status:update": "USER_ACTION",
    "auth:status-denied": "USER_ACTION",
  };

  return typeMap[action] || "USER_ACTION";
}

export function shouldSkipEmail(action) {
  return action === "skill:list";
}

export function getInitialEmailStatus(action, emailConfig) {
  if (shouldSkipEmail(action)) {
    return "SKIPPED";
  }

  if (!emailConfig) {
    return "NOT_CONFIGURED";
  }

  return "PENDING";
}

export function getNotificationTitle(action) {
  const titleMap = {
    "skill:list": "Skills Listed",
    "skill:read": "Skill Read",
    "skill:create": "New Skill Created",
    "skill:update": "Skill Updated",
    "skill:delete": "Skill Deleted",
    "skill:import": "Skill Imported",
    "skill:preview": "Skill Previewed",
    "skill:use": "Skill Used",
    "skill:test": "Skill Tested",
    "skill:execute": "Skill Executed",
    "skill:test:fail": "Skill Test Failed",
    "skill:execute:fail": "Skill Execution Failed",
    "skill:file:update": "Skill File Updated",
    "skill:file:restore": "Skill File Restored",
    "context:update": "Context File Updated",
    "workflow:create": "New Workflow Created",
    "workflow:update": "Workflow Updated",
    "workflow:delete": "Workflow Deleted",
    "workflow:run:start": "Workflow Execution Started",
    "workflow:run:complete": "Workflow Execution Completed",
    "workflow:run:fail": "Workflow Execution Failed",
    "skill-change:request": "Skill Change Requested",
    "skill-change:approve": "Skill Change Approved",
    "skill-change:reject": "Skill Change Rejected",
    "user:role:update": "User Role Updated",
    "user:branch:update": "User Branch Updated",
    "user:external-id:update": "User External ID Updated",
    "user:status:update": "User Status Updated",
    "auth:status-denied": "Inactive User Blocked",
  };

  return titleMap[action] || "System Action";
}

export function getActionLabel(action) {
  const labelMap = {
    "skill:read": "Skill read",
    "skill:create": "Skill created",
    "skill:update": "Skill updated",
    "skill:delete": "Skill deleted",
    "skill:import": "Skill imported",
    "skill:preview": "Skill previewed",
    "skill:use": "Skill used",
    "skill:test": "Skill tested",
    "skill:execute": "Skill executed",
    "skill:test:fail": "Skill test failed",
    "skill:execute:fail": "Skill execution failed",
    "skill:file:update": "Skill file updated",
    "skill:file:restore": "Skill file restored",
    "context:update": "Context file updated",
    "workflow:create": "Workflow created",
    "workflow:update": "Workflow updated",
    "workflow:delete": "Workflow deleted",
    "workflow:run:start": "Workflow run started",
    "workflow:run:complete": "Workflow run completed",
    "workflow:run:fail": "Workflow run failed",
    "skill-change:request": "Skill change requested",
    "skill-change:approve": "Skill change approved",
    "skill-change:reject": "Skill change rejected",
    "user:role:update": "User role updated",
    "user:branch:update": "User branch updated",
    "user:external-id:update": "User external ID updated",
    "user:status:update": "User status updated",
    "auth:status-denied": "Inactive user blocked",
  };

  return labelMap[action] || action;
}
