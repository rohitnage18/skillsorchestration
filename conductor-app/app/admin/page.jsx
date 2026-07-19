import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth.js";
import { db } from "../../lib/db";
import {
  approveSkillChangeRequest,
  rejectSkillChangeRequest,
} from "../../lib/skillChangeRequests.js";
import {
  getSkillInsights,
  getSkillVersionComparison,
  listSkills,
  listSkillVersions,
  listVersionedSkillFiles,
  listImportedWorkspaces,
  loadImportedWorkspaceContext,
  restoreSkillVersion,
  saveImportedWorkspaceContext,
} from "../../lib/skillStorage.js";
import {
  createReleaseSnapshot,
  getImportedWorkspaceIntelligence,
  getRepositoryBranchHealth,
  getSkillDependencyGraph,
  listReleaseSnapshots,
  seedDemoWorkspaceData,
} from "../../lib/operations.js";
import { logAction, resendNotificationEmail } from "../../features/logging/server-functions";

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatAction(action) {
  return action
    .replace(/[-_:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "No payload";
  }

  if (payload.type === "SKILL_CREATE") {
    return `Create ${payload.skillName}`;
  }

  if (payload.type === "SKILL_IMPORT") {
    return `Import ${payload.skillName} to ${payload.targetName}`;
  }

  if (payload.type === "SKILL_FILE_UPDATE") {
    return `Update ${payload.skillName}/${payload.path}`;
  }

  return JSON.stringify(payload);
}

function emailStatusClass(status) {
  if (status === "SENT") return "success";
  if (status === "FAILED") return "danger";
  return "neutral";
}

function userStatusClass(status) {
  if (status === "ACTIVE") return "success";
  if (status === "DISABLED") return "danger";
  return "neutral";
}

function canResendEmail(status, auditLogId) {
  return auditLogId && ["FAILED", "PENDING", "NOT_CONFIGURED"].includes(status);
}

function getStringParam(searchParams, key) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value || "";
}

function parseHistoryTarget(value) {
  const normalized = String(value || "");
  const separatorIndex = normalized.indexOf("::");
  if (separatorIndex === -1) {
    return { skillName: "", filePath: "" };
  }

  return {
    skillName: normalized.slice(0, separatorIndex),
    filePath: normalized.slice(separatorIndex + 2),
  };
}

function formatVersionActor(actor) {
  if (!actor || typeof actor !== "object") {
    return "Unknown actor";
  }

  return actor.name || actor.email || actor.id || "Unknown actor";
}

function formatVersionPreview(preview) {
  const text = String(preview || "").replace(/\s+/g, " ").trim();
  return text || "No preview available.";
}

function joinMeta(parts) {
  return parts.filter(Boolean).join(" | ");
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildAuditWhere(filters) {
  const where = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.resource) where.resource = filters.resource;
  if (filters.skill) where.resourceId = { contains: filters.skill, mode: "insensitive" };
  if (filters.source) where.metadata = { path: ["source"], equals: filters.source };
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    if (filters.dateTo) where.createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
  }
  return where;
}

function normalizePreferredBranch(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (!/^(users\/[A-Za-z0-9._-]+|[A-Za-z0-9._-]+)$/.test(normalized)) {
    throw new Error("Preferred branch must look like users/sanay or sanay.");
  }

  return normalized;
}

function collectUserActivity(logs, users) {
  const activityByUser = new Map(
    users.map((user) => [
      user.id,
      {
        user,
        totalActions: 0,
        lastActionAt: null,
        recentActions: new Set(),
        touchedSkills: new Set(),
        touchedWorkflows: new Set(),
        touchedWorkspaces: new Set(),
      },
    ])
  );

  for (const log of logs) {
    const activity =
      activityByUser.get(log.userId) ||
      {
        user: log.user || { id: log.userId, email: log.userId, name: null },
        totalActions: 0,
        lastActionAt: null,
        recentActions: new Set(),
        touchedSkills: new Set(),
        touchedWorkflows: new Set(),
        touchedWorkspaces: new Set(),
      };

    activity.totalActions += 1;
    activity.lastActionAt =
      !activity.lastActionAt || new Date(log.createdAt) > new Date(activity.lastActionAt)
        ? log.createdAt
        : activity.lastActionAt;
    activity.recentActions.add(log.action);

    const metadata = log.metadata && typeof log.metadata === "object" ? log.metadata : {};

    if (metadata.skillName) {
      activity.touchedSkills.add(String(metadata.skillName));
    } else if (log.resource === "skill" && log.resourceId) {
      activity.touchedSkills.add(String(log.resourceId));
    }

    if (metadata.workflowName) {
      activity.touchedWorkflows.add(String(metadata.workflowName));
    } else if (metadata.workflowId) {
      activity.touchedWorkflows.add(String(metadata.workflowId));
    } else if (log.resource === "workflow" && log.resourceId) {
      activity.touchedWorkflows.add(String(log.resourceId));
    }

    if (metadata.importedTo) {
      activity.touchedWorkspaces.add(String(metadata.importedTo));
    } else if (log.resource === "context" && log.resourceId) {
      activity.touchedWorkspaces.add(String(log.resourceId));
    }

    activityByUser.set(log.userId, activity);
  }

  return Array.from(activityByUser.values())
    .filter((entry) => entry.totalActions > 0)
    .sort(
      (left, right) =>
        new Date(right.lastActionAt).getTime() - new Date(left.lastActionAt).getTime() ||
        right.totalActions - left.totalActions
    );
}

async function setUserRole(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "");
  if (!userId || !["ADMIN", "USER"].includes(role)) {
    throw new Error("Valid user and role are required.");
  }

  const existingUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!existingUser) {
    throw new Error("User not found.");
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });

  await logAction({
    userId: session.user.id,
    action: "user:role:update",
    resource: "user",
    resourceId: updatedUser.id,
    changes: {
      before: existingUser,
      after: updatedUser,
    },
    metadata: {
      targetUserEmail: updatedUser.email,
      source: "admin-dashboard",
    },
  });
  revalidatePath("/admin");
}

async function setUserStatus(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  const userId = String(formData.get("userId") || "");
  const status = String(formData.get("status") || "");
  if (!userId || !["INVITED", "PENDING", "ACTIVE", "DISABLED"].includes(status)) {
    throw new Error("Valid user and status are required.");
  }

  const existingUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  if (!existingUser) {
    throw new Error("User not found.");
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { status },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  await logAction({
    userId: session.user.id,
    action: "user:status:update",
    resource: "user",
    resourceId: updatedUser.id,
    changes: {
      before: existingUser,
      after: updatedUser,
    },
    metadata: {
      targetUserEmail: updatedUser.email,
      source: "admin-dashboard",
    },
  });
  revalidatePath("/admin");
}

async function setUserPreferredBranch(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  const userId = String(formData.get("userId") || "");
  const preferredBranch = normalizePreferredBranch(formData.get("preferredBranch"));
  if (!userId) {
    throw new Error("Valid user is required.");
  }

  const existingUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, preferredBranch: true },
  });

  if (!existingUser) {
    throw new Error("User not found.");
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { preferredBranch: preferredBranch || null },
    select: { id: true, email: true, name: true, preferredBranch: true },
  });

  await logAction({
    userId: session.user.id,
    action: "user:branch:update",
    resource: "user",
    resourceId: updatedUser.id,
    changes: {
      before: existingUser,
      after: updatedUser,
    },
    metadata: {
      targetUserEmail: updatedUser.email,
      source: "admin-dashboard",
    },
  });
  revalidatePath("/admin");
}

async function setUserExternalIdentity(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  const userId = String(formData.get("userId") || "");
  const externalUserId = String(formData.get("externalUserId") || "").trim();
  if (!userId) {
    throw new Error("Valid user is required.");
  }
  if (externalUserId && !/^[A-Za-z0-9._-]+$/.test(externalUserId)) {
    throw new Error("External user id may contain only letters, numbers, dots, underscores, and hyphens.");
  }

  const existingUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, externalUserId: true },
  });

  if (!existingUser) {
    throw new Error("User not found.");
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { externalUserId: externalUserId || null },
    select: { id: true, email: true, name: true, externalUserId: true },
  });

  await logAction({
    userId: session.user.id,
    action: "user:external-id:update",
    resource: "user",
    resourceId: updatedUser.id,
    changes: {
      before: existingUser,
      after: updatedUser,
    },
    metadata: {
      targetUserEmail: updatedUser.email,
      source: "admin-dashboard",
    },
  });
  revalidatePath("/admin");
}

async function approveRequest(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  await approveSkillChangeRequest(String(formData.get("requestId") || ""), session.user.id);
  revalidatePath("/admin");
}

async function rejectRequest(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  await rejectSkillChangeRequest(String(formData.get("requestId") || ""), session.user.id, {
    reason: String(formData.get("reason") || ""),
  });
  revalidatePath("/admin");
}

async function resendEmail(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  const result = await resendNotificationEmail(String(formData.get("notificationId") || ""));
  if (!result.success) {
    throw new Error(result.error || "Failed to resend notification email.");
  }
  revalidatePath("/admin");
}

async function markNotificationRead(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  await db.notification.updateMany({
    where: {
      id: String(formData.get("notificationId") || ""),
      userId: session.user.id,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
  revalidatePath("/admin");
}

async function markAllNotificationsRead() {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  await db.notification.updateMany({
    where: {
      userId: session.user.id,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
  revalidatePath("/admin");
}

async function restoreVersion(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  const skillName = String(formData.get("skillName") || "");
  const filePath = String(formData.get("filePath") || "");
  const versionId = String(formData.get("versionId") || "");

  await restoreSkillVersion(skillName, filePath, versionId, session.user.id);
  revalidatePath("/admin");
  redirect(`/admin?historyTarget=${encodeURIComponent(`${skillName}::${filePath}`)}`);
}

async function saveWorkspaceContext(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  const workspaceName = String(formData.get("workspaceName") || "");
  const content = String(formData.get("content") || "");
  await saveImportedWorkspaceContext(workspaceName, content, session.user.id);
  revalidatePath("/admin");
  redirect(`/admin?contextWorkspace=${encodeURIComponent(workspaceName)}`);
}

async function captureReleaseSnapshot(formData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  const label = String(formData.get("label") || "Stable snapshot");
  createReleaseSnapshot(label);
  revalidatePath("/admin");
}

async function seedDemoData() {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Admin permission is required.");
  }

  seedDemoWorkspaceData();
  revalidatePath("/admin");
}

export default async function AdminDashboardPage({ searchParams }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <section className="admin-shell">
        <div className="empty-state">
          <h1>{["PENDING", "INVITED"].includes(session.user.status) ? "Approval pending" : "Admin access required"}</h1>
          <p>
            {session.user.status === "INVITED"
              ? "Your account has been invited, but it is not active yet."
              : session.user.status === "PENDING"
                ? "Your account is signed in, but an admin still needs to approve it."
                : "Your account is signed in, but it is not marked as `ADMIN` in Prisma."}
          </p>
        </div>
      </section>
    );
  }

  const resolvedSearchParams = await searchParams;
  const auditFilters = {
    userId: getStringParam(resolvedSearchParams, "userId"),
    action: getStringParam(resolvedSearchParams, "action"),
    resource: getStringParam(resolvedSearchParams, "resource"),
    skill: getStringParam(resolvedSearchParams, "skill"),
    source: getStringParam(resolvedSearchParams, "source"),
    dateFrom: getStringParam(resolvedSearchParams, "dateFrom"),
    dateTo: getStringParam(resolvedSearchParams, "dateTo"),
  };
  const auditWhere = buildAuditWhere(auditFilters);
  const auditActions = await db.auditLog.findMany({
    distinct: ["action"],
    orderBy: { action: "asc" },
    select: { action: true },
  });
  const auditResources = await db.auditLog.findMany({
    distinct: ["resource"],
    orderBy: { resource: "asc" },
    select: { resource: true },
  });
  const versionedSkillFiles = listVersionedSkillFiles();
  const requestedHistoryTarget = parseHistoryTarget(getStringParam(resolvedSearchParams, "historyTarget"));
  const selectedHistoryFile =
    versionedSkillFiles.find(
      (entry) =>
        entry.skillName === requestedHistoryTarget.skillName && entry.filePath === requestedHistoryTarget.filePath
    ) || versionedSkillFiles[0] || null;
  const versionHistory = selectedHistoryFile
    ? listSkillVersions(selectedHistoryFile.skillName, selectedHistoryFile.filePath, 30)
    : [];
  const selectedVersionA =
    getStringParam(resolvedSearchParams, "versionA") || versionHistory[1]?.id || versionHistory[0]?.id || "";
  const selectedVersionB =
    getStringParam(resolvedSearchParams, "versionB") || versionHistory[0]?.id || versionHistory[1]?.id || "";
  const versionComparison =
    selectedHistoryFile && selectedVersionA && selectedVersionB && selectedVersionA !== selectedVersionB
      ? getSkillVersionComparison(
          selectedHistoryFile.skillName,
          selectedHistoryFile.filePath,
          selectedVersionA,
          selectedVersionB
        )
      : null;
  const importedWorkspaces = listImportedWorkspaces();
  const skillLibrary = listSkills();
  const skillInsights = getSkillInsights();
  const dependencyGraph = getSkillDependencyGraph();
  const workspaceIntelligence = getImportedWorkspaceIntelligence();
  const repositoryHealth = getRepositoryBranchHealth();
  const releaseSnapshots = listReleaseSnapshots();
  const topSkillTags = skillInsights.tagSummary.slice(0, 8);
  const topSkillOwners = skillInsights.ownerSummary.slice(0, 8);
  const staleSkills = skillLibrary.filter((skill) => skill.freshnessStatus === "stale").slice(0, 8);
  const topStableSkills = skillLibrary
    .filter((skill) => skill.scorecard?.stability === "stable")
    .sort((left, right) => right.scorecard.score - left.scorecard.score || left.name.localeCompare(right.name))
    .slice(0, 8);
  const atRiskSkills = skillLibrary
    .filter((skill) => skill.healthStatus !== "passed" || skill.qualityStatus === "draft")
    .slice(0, 8);
  const latestQaReports = skillLibrary
    .filter((skill) => skill.latestQaReport?.createdAt)
    .sort(
      (left, right) =>
        new Date(right.latestQaReport.createdAt).getTime() - new Date(left.latestQaReport.createdAt).getTime()
    )
    .slice(0, 8);
  const selectedWorkspaceName =
    getStringParam(resolvedSearchParams, "contextWorkspace") || importedWorkspaces[0]?.name || "";
  const selectedWorkspace =
    importedWorkspaces.find((workspace) => workspace.name === selectedWorkspaceName) || importedWorkspaces[0] || null;
  const selectedWorkspaceContext = selectedWorkspace
    ? loadImportedWorkspaceContext(selectedWorkspace.name)
    : "";
  const selectedWorkspaceInsight =
    workspaceIntelligence.workspaces.find((workspace) => workspace.name === selectedWorkspaceName) ||
    workspaceIntelligence.workspaces[0] ||
    null;

  const [
    users,
    auditLogs,
    userActivityLogs,
    notifications,
    pendingRequests,
    reviewedRequests,
    auditActionGroups,
    notificationTypeGroups,
    userStatusGroups,
    userCount,
    adminCount,
    normalUserCount,
    logCount,
    notificationCount,
    sentEmailCount,
    failedEmailCount,
    pendingEmailCount,
    skippedEmailCount,
    notConfiguredEmailCount,
    unreadNotificationCount,
    pendingRequestCount,
    approvedRequestCount,
    rejectedRequestCount,
    workflowStatusGroups,
    recentFailedWorkflowRuns,
    recentWorkflowRuns,
  ] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        externalUserId: true,
        preferredBranch: true,
        role: true,
        status: true,
        updatedAt: true,
        lastSeenAt: true,
      },
    }),
    db.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: {
          select: {
            email: true,
            name: true,
            role: true,
          },
        },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 400,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    db.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    db.skillChangeRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        requestedBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    db.skillChangeRequest.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      include: {
        requestedBy: {
          select: {
            email: true,
            name: true,
          },
        },
        reviewedBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    db.auditLog.groupBy({
      by: ["action"],
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
      take: 8,
    }),
    db.notification.groupBy({
      by: ["type"],
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 8,
    }),
    db.user.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { role: "USER" } }),
    db.auditLog.count(),
    db.notification.count(),
    db.notification.count({ where: { emailSent: true } }),
    db.notification.count({ where: { emailStatus: "FAILED" } }),
    db.notification.count({ where: { emailStatus: "PENDING" } }),
    db.notification.count({ where: { emailStatus: "SKIPPED" } }),
    db.notification.count({ where: { emailStatus: "NOT_CONFIGURED" } }),
    db.notification.count({ where: { read: false } }),
    db.skillChangeRequest.count({ where: { status: "PENDING" } }),
    db.skillChangeRequest.count({ where: { status: "APPROVED" } }),
    db.skillChangeRequest.count({ where: { status: "REJECTED" } }),
    db.workflowRun.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.workflowRun.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        workflow: {
          select: { id: true, name: true },
        },
        user: {
          select: { email: true, name: true },
        },
      },
    }),
    db.workflowRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 16,
      include: {
        workflow: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const userActivity = collectUserActivity(userActivityLogs, users);
  const userStatusSummary = userStatusGroups.reduce((summary, group) => {
    summary[group.status] = group._count.status;
    return summary;
  }, {});
  const invitedUserCount = userStatusSummary.INVITED || 0;
  const pendingUserCount = userStatusSummary.PENDING || 0;
  const disabledUserCount = userStatusSummary.DISABLED || 0;
  const workflowSummary = workflowStatusGroups.reduce((summary, group) => {
    summary[group.status] = group._count.status;
    return summary;
  }, {});

  const deliverableEmailCount = sentEmailCount + failedEmailCount + pendingEmailCount;
  const emailDeliveryRate =
    deliverableEmailCount > 0 ? Math.round((sentEmailCount / deliverableEmailCount) * 100) : 0;
  const totalWorkflowRuns = Object.values(workflowSummary).reduce((total, count) => total + count, 0);
  const workflowFailureRate =
    totalWorkflowRuns > 0 ? Math.round(((workflowSummary.FAILED || 0) / totalWorkflowRuns) * 100) : 0;
  const validationTrend = {
    failed: skillInsights.healthSummary.failed || 0,
    warning: skillInsights.healthSummary.warning || 0,
    passed: skillInsights.healthSummary.passed || 0,
  };

  return (
    <section className="admin-shell">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Admin command center</p>
          <h1>Users, approvals, audit logs, notifications, and email delivery</h1>
          <p className="muted-text">
            Review guardrail approvals, manage team roles, inspect audit activity, and track email delivery from one place.
          </p>
        </div>
        <span className="status-pill success">Signed in as {session.user.email}</span>
      </div>

      <div className="admin-metrics">
        <div className="metric-card">
          <p>Users</p>
          <strong>{userCount}</strong>
          <span>{joinMeta([`${adminCount} admin`, `${normalUserCount} user`])}</span>
          <span>{joinMeta([`${invitedUserCount} invited`, `${pendingUserCount} pending`, `${disabledUserCount} disabled`])}</span>
        </div>
        <div className="metric-card">
          <p>Audit logs</p>
          <strong>{logCount}</strong>
          <span>{auditLogs.length} shown</span>
        </div>
        <div className="metric-card">
          <p>Notifications</p>
          <strong>{notificationCount}</strong>
          <span>{unreadNotificationCount} unread</span>
        </div>
        <div className="metric-card">
          <p>Email delivery</p>
          <strong>{emailDeliveryRate}%</strong>
          <span>{joinMeta([`${sentEmailCount} sent`, `${failedEmailCount} failed`, `${pendingEmailCount} pending`])}</span>
          <span>{joinMeta([`${skippedEmailCount} skipped`, `${notConfiguredEmailCount} not configured`])}</span>
        </div>
        <div className="metric-card">
          <p>Approvals</p>
          <strong>{pendingRequestCount}</strong>
          <span>{joinMeta([`${approvedRequestCount} approved`, `${rejectedRequestCount} rejected`])}</span>
        </div>
        <div className="metric-card">
          <p>Skill library</p>
          <strong>{skillInsights.totalSkills}</strong>
          <span>{joinMeta([`${skillInsights.importedSkills} imported`, `${skillInsights.readySkills} ready`])}</span>
          <span>{joinMeta([`${skillInsights.healthSummary.failed || 0} failed`, `${skillInsights.healthSummary.warning || 0} warnings`])}</span>
        </div>
      </div>

      <section className="admin-card wide">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Audit log search</h2>
          </div>
          <a className="button secondary compact" href="/admin">
            Clear filters
          </a>
        </div>
        <form className="admin-filter-grid">
          <label className="form-field">
            <span>User</span>
            <select name="userId" defaultValue={auditFilters.userId} className="search-field">
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Action</span>
            <select name="action" defaultValue={auditFilters.action} className="search-field">
              <option value="">All actions</option>
              {auditActions.map((item) => (
                <option key={item.action} value={item.action}>
                  {item.action}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Resource</span>
            <select name="resource" defaultValue={auditFilters.resource} className="search-field">
              <option value="">All resources</option>
              {auditResources.map((item) => (
                <option key={item.resource} value={item.resource}>
                  {item.resource}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Skill / ID</span>
            <input name="skill" defaultValue={auditFilters.skill} className="search-field" placeholder="frontend" />
          </label>
          <label className="form-field">
            <span>Source</span>
            <input name="source" defaultValue={auditFilters.source} className="search-field" placeholder="vscode-extension" />
          </label>
          <label className="form-field">
            <span>From</span>
            <input type="date" name="dateFrom" defaultValue={auditFilters.dateFrom} className="search-field" />
          </label>
          <label className="form-field">
            <span>To</span>
            <input type="date" name="dateTo" defaultValue={auditFilters.dateTo} className="search-field" />
          </label>
          <button className="button primary" type="submit">
            Apply filters
          </button>
        </form>
      </section>

      <div className="admin-grid">
        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Guardrails</p>
              <h2>Pending skill change approvals</h2>
            </div>
            <span className="status-pill neutral">{pendingRequestCount} pending</span>
          </div>
          <div className="admin-table">
            {pendingRequests.length > 0 ? (
              pendingRequests.map((request) => (
                <div className="admin-row" key={request.id}>
                  <div>
                    <strong>{formatPayload(request.payload)}</strong>
                    <span>
                      {joinMeta([
                        request.requestedBy?.name || request.requestedBy?.email || request.requestedById,
                        request.type,
                        formatDate(request.createdAt),
                      ])}
                    </span>
                  </div>
                  <div className="admin-actions">
                    <form action={approveRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <button className="button primary compact" type="submit">
                        Approve
                      </button>
                    </form>
                    <form action={rejectRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="reason" value="Rejected from admin dashboard" />
                      <button className="button secondary compact" type="submit">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No pending skill change requests.</div>
            )}
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Review history</p>
              <h2>Recent approval decisions</h2>
            </div>
          </div>
          <div className="admin-table">
            {reviewedRequests.length > 0 ? (
              reviewedRequests.map((request) => (
                <div className="admin-row" key={request.id}>
                  <div>
                    <strong>{formatPayload(request.payload)}</strong>
                    <span>
                      {joinMeta([
                        `Requested by ${request.requestedBy?.name || request.requestedBy?.email || request.requestedById}`,
                        `Reviewed by ${request.reviewedBy?.name || request.reviewedBy?.email || "unknown"}`,
                        request.reviewedAt ? formatDate(request.reviewedAt) : "No review time",
                      ])}
                    </span>
                  </div>
                  <span className={`status-pill ${request.status === "APPROVED" ? "success" : "danger"}`}>
                    {request.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-state">No approval decisions yet.</div>
            )}
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Version history</p>
              <h2>Compare, audit, and restore skill files</h2>
            </div>
            <span className="status-pill neutral">{versionedSkillFiles.length} tracked files</span>
          </div>

          {versionedSkillFiles.length > 0 ? (
            <>
              <form className="admin-filter-grid">
                <label className="form-field">
                  <span>Tracked file</span>
                  <select
                    name="historyTarget"
                    defaultValue={
                      selectedHistoryFile ? `${selectedHistoryFile.skillName}::${selectedHistoryFile.filePath}` : ""
                    }
                    className="search-field"
                  >
                    {versionedSkillFiles.map((entry) => (
                      <option key={`${entry.skillName}:${entry.filePath}`} value={`${entry.skillName}::${entry.filePath}`}>
                        {entry.skillName} / {entry.filePath}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Older version</span>
                  <select name="versionA" defaultValue={selectedVersionA} className="search-field">
                    {versionHistory.map((version) => (
                      <option key={version.id} value={version.id}>
                        {formatDate(new Date(version.createdAt))} - {formatVersionActor(version.actor)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Newer version</span>
                  <select name="versionB" defaultValue={selectedVersionB} className="search-field">
                    {versionHistory.map((version) => (
                      <option key={version.id} value={version.id}>
                        {formatDate(new Date(version.createdAt))} - {formatVersionActor(version.actor)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button primary" type="submit">
                  Compare versions
                </button>
              </form>

              <div className="version-history-grid">
                <div className="version-history-list">
                  {selectedHistoryFile ? (
                    <div className="version-summary-card">
                      <strong>
                        {selectedHistoryFile.skillName} / {selectedHistoryFile.filePath}
                      </strong>
                      <span>
                        {joinMeta([
                          `${selectedHistoryFile.versionCount} versions tracked`,
                          `Latest ${formatDate(new Date(selectedHistoryFile.latestVersion.createdAt))}`,
                        ])}
                      </span>
                    </div>
                  ) : null}

                  <div className="admin-table">
                    {versionHistory.map((version) => (
                      <div className="admin-row version-row" key={version.id}>
                        <div>
                          <strong>{formatAction(version.action)}</strong>
                          <span>
                            {joinMeta([
                              formatVersionActor(version.actor),
                              formatDate(new Date(version.createdAt)),
                            ])}
                          </span>
                          <span>{formatVersionPreview(version.preview)}</span>
                        </div>
                        <div className="admin-actions">
                          <span className="status-pill neutral">{Math.round((version.bytes || 0) / 1024 * 10) / 10} KB</span>
                          <form action={restoreVersion}>
                            <input type="hidden" name="skillName" value={selectedHistoryFile?.skillName || ""} />
                            <input type="hidden" name="filePath" value={selectedHistoryFile?.filePath || ""} />
                            <input type="hidden" name="versionId" value={version.id} />
                            <button className="button secondary compact" type="submit">
                              Restore
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="version-compare-panel">
                  {versionComparison ? (
                    <>
                      <div className="version-diff-stats">
                        <div className="summary-item">
                          <span>Added lines</span>
                          <strong>{versionComparison.diffSummary.added}</strong>
                        </div>
                        <div className="summary-item">
                          <span>Removed lines</span>
                          <strong>{versionComparison.diffSummary.removed}</strong>
                        </div>
                        <div className="summary-item">
                          <span>Changed lines</span>
                          <strong>{versionComparison.diffSummary.changed}</strong>
                        </div>
                        <div className="summary-item">
                          <span>Unchanged lines</span>
                          <strong>{versionComparison.diffSummary.unchanged}</strong>
                        </div>
                      </div>

                      <div className="version-compare-grid">
                        <div className="version-code-card">
                          <div className="panel-header">
                            <div>
                              <p className="eyebrow">Older</p>
                              <h3>{formatAction(versionComparison.previousVersion.action)}</h3>
                            </div>
                            <span className="status-pill neutral">
                              {formatDate(new Date(versionComparison.previousVersion.createdAt))}
                            </span>
                          </div>
                          <p className="muted-text">
                            {formatVersionActor(versionComparison.previousVersion.actor)}
                          </p>
                          <pre>{versionComparison.previousVersion.content}</pre>
                        </div>
                        <div className="version-code-card">
                          <div className="panel-header">
                            <div>
                              <p className="eyebrow">Newer</p>
                              <h3>{formatAction(versionComparison.nextVersion.action)}</h3>
                            </div>
                            <span className="status-pill neutral">
                              {formatDate(new Date(versionComparison.nextVersion.createdAt))}
                            </span>
                          </div>
                          <p className="muted-text">
                            {formatVersionActor(versionComparison.nextVersion.actor)}
                          </p>
                          <pre>{versionComparison.nextVersion.content}</pre>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      Pick two different versions of the same file to compare them side by side.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">No skill file versions have been captured yet. Save a skill file to start tracking history.</div>
          )}
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Context workflow</p>
              <h2>Imported workspace context files</h2>
            </div>
            <span className="status-pill neutral">{importedWorkspaces.length} workspaces</span>
          </div>

          {importedWorkspaces.length > 0 ? (
            <div className="context-admin-grid">
              <div className="context-admin-sidebar">
                <form className="form-field">
                  <span>Workspace</span>
                  <select name="contextWorkspace" defaultValue={selectedWorkspace?.name || ""} className="search-field">
                    {importedWorkspaces.map((workspace) => (
                      <option key={workspace.name} value={workspace.name}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                  <button className="button secondary compact" type="submit">
                    Load context
                  </button>
                </form>

                <div className="admin-table compact-list">
                  {importedWorkspaces.map((workspace) => (
                    <a
                      key={workspace.name}
                      href={`/admin?contextWorkspace=${encodeURIComponent(workspace.name)}`}
                      className={`workspace-pill ${selectedWorkspace?.name === workspace.name ? "active" : ""}`}
                    >
                      <strong>{workspace.name}</strong>
                      <span>
                        {workspace.hasContext
                          ? `Context updated ${formatDate(new Date(workspace.contextUpdatedAt))}`
                          : "No context yet"}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              <div className="context-admin-panel">
                {selectedWorkspace ? (
                  <form action={saveWorkspaceContext} className="skill-editor-panel">
                    <div className="editor-toolbar">
                      <div>
                        <p className="eyebrow">Editing</p>
                        <h3>{selectedWorkspace.name}/CONTEXT.md</h3>
                        <p className="status-copy">
                          Changes saved here are logged as `context:update` audit events.
                        </p>
                      </div>
                      <input type="hidden" name="workspaceName" value={selectedWorkspace.name} />
                      <button className="button primary" type="submit">
                        Save context
                      </button>
                    </div>
                    <textarea
                      className="editor-textarea"
                      name="content"
                      defaultValue={selectedWorkspaceContext}
                    />
                  </form>
                ) : (
                  <div className="empty-state">Import a skill into a workspace to start managing its `CONTEXT.md` file here.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">No imported workspaces yet. Import a skill workspace first to manage its context.</div>
          )}
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dependency graph</p>
              <h2>Skill relationships, overlap, and reuse</h2>
              <p className="muted-text">
                Track where skills look duplicated, share references, or sit in the same problem space.
              </p>
            </div>
            <span className="status-pill neutral">
              {dependencyGraph.nodeCount} skills / {dependencyGraph.edgeCount} links
            </span>
          </div>

          <div className="admin-grid">
            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Hotspots</p>
                  <h3>Most connected skills</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {dependencyGraph.mostConnectedSkills.length > 0 ? (
                  dependencyGraph.mostConnectedSkills.map((item) => (
                    <div className="admin-row" key={item.skillName}>
                      <div>
                        <strong>{item.skillName}</strong>
                        <span>
                          {joinMeta([
                            `${item.overlapCount} relationship${item.overlapCount === 1 ? "" : "s"}`,
                            `Health ${item.healthStatus}`,
                            `Quality ${item.qualityStatus}`,
                          ])}
                        </span>
                      </div>
                      <a className="button secondary compact" href={`/skills/${encodeURIComponent(item.skillName)}`}>
                        Open
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No strong skill relationships detected yet.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Overlap links</p>
                  <h3>Top relationship edges</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {dependencyGraph.topEdges.length > 0 ? (
                  dependencyGraph.topEdges.slice(0, 10).map((edge) => (
                    <div className="admin-row" key={`${edge.source}:${edge.target}`}>
                      <div>
                        <strong>
                          {edge.source} {"->"} {edge.target}
                        </strong>
                        <span>{joinMeta([titleCase(edge.relationship), ...edge.reasons.slice(0, 2)])}</span>
                      </div>
                      <span className="status-pill neutral">{Math.round(edge.score * 100)}%</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No overlapping skills are strong enough to show yet.</div>
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">GitHub integration</p>
              <h2>Branch health, checks, and merge readiness</h2>
              <p className="muted-text">
                This local repository integration shows whether the current branch is clean and ready for a manual PR.
              </p>
            </div>
            <span className={`status-pill ${repositoryHealth.mergeReadiness.ready ? "success" : "danger"}`}>
              {repositoryHealth.integrationMode}
            </span>
          </div>

          <div className="version-diff-stats">
            <div className="summary-item">
              <span>Current branch</span>
              <strong>{repositoryHealth.branch}</strong>
            </div>
            <div className="summary-item">
              <span>Commit</span>
              <strong>{repositoryHealth.commit || "unknown"}</strong>
            </div>
            <div className="summary-item">
              <span>Ahead</span>
              <strong>{repositoryHealth.ahead}</strong>
            </div>
            <div className="summary-item">
              <span>Behind</span>
              <strong>{repositoryHealth.behind}</strong>
            </div>
            <div className="summary-item">
              <span>Workflow files</span>
              <strong>{repositoryHealth.workflowFiles.length}</strong>
            </div>
            <div className="summary-item">
              <span>Merge readiness</span>
              <strong>{repositoryHealth.mergeReadiness.ready ? "Ready" : "Action needed"}</strong>
            </div>
          </div>

          <div className="admin-grid">
            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Policy</p>
                  <h3>Branch rules</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                <div className="admin-row">
                  <div>
                    <strong>Manual PR to main</strong>
                    <span>Direct pushes should stay blocked and releases should merge after checks pass.</span>
                  </div>
                  <span className="status-pill success">Enabled</span>
                </div>
                <div className="admin-row">
                  <div>
                    <strong>Personal branch expectation</strong>
                    <span>Users should work on their branch and keep `main` protected.</span>
                  </div>
                  <span className="status-pill success">Enabled</span>
                </div>
                <div className="admin-row">
                  <div>
                    <strong>Remote</strong>
                    <span>{repositoryHealth.remote || "No origin configured"}</span>
                  </div>
                  <span className="status-pill neutral">{repositoryHealth.upstream || "No upstream"}</span>
                </div>
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">PR readiness</p>
                  <h3>Current branch blockers</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {repositoryHealth.mergeReadiness.issues.length > 0 ? (
                  repositoryHealth.mergeReadiness.issues.map((issue) => (
                    <div className="admin-row" key={issue}>
                      <div>
                        <strong>{issue}</strong>
                        <span>Resolve this before opening or merging a pull request.</span>
                      </div>
                      <span className="status-pill danger">Blocked</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Current branch looks clean for a manual PR review.</div>
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">System health</p>
              <h2>Workflow failures, notification health, and validation trends</h2>
            </div>
            <span className="status-pill neutral">{totalWorkflowRuns} workflow runs tracked</span>
          </div>

          <div className="version-diff-stats">
            <div className="summary-item">
              <span>Workflow failures</span>
              <strong>{workflowSummary.FAILED || 0}</strong>
            </div>
            <div className="summary-item">
              <span>Failure rate</span>
              <strong>{workflowFailureRate}%</strong>
            </div>
            <div className="summary-item">
              <span>Email failures</span>
              <strong>{failedEmailCount}</strong>
            </div>
            <div className="summary-item">
              <span>Pending emails</span>
              <strong>{pendingEmailCount}</strong>
            </div>
            <div className="summary-item">
              <span>Validation warnings</span>
              <strong>{validationTrend.warning}</strong>
            </div>
            <div className="summary-item">
              <span>Validation failures</span>
              <strong>{validationTrend.failed}</strong>
            </div>
          </div>

          <div className="admin-grid">
            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Workflow health</p>
                  <h3>Recent failed runs</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {recentFailedWorkflowRuns.length > 0 ? (
                  recentFailedWorkflowRuns.map((run) => (
                    <div className="admin-row" key={run.id}>
                      <div>
                        <strong>{run.workflow?.name || run.workflowId}</strong>
                        <span>
                          {joinMeta([
                            run.user?.name || run.user?.email || run.userId,
                            formatDate(run.createdAt),
                            run.completedAt ? `Completed ${formatDate(run.completedAt)}` : "Not completed",
                          ])}
                        </span>
                      </div>
                      <span className="status-pill danger">{run.status}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No failed workflow runs recorded.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Run stream</p>
                  <h3>Recent workflow activity</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {recentWorkflowRuns.length > 0 ? (
                  recentWorkflowRuns.map((run) => (
                    <div className="admin-row" key={run.id}>
                      <div>
                        <strong>{run.workflow?.name || run.workflowId}</strong>
                        <span>{joinMeta([run.status, formatDate(run.createdAt)])}</span>
                      </div>
                      <span
                        className={`status-pill ${
                          run.status === "SUCCEEDED" ? "success" : run.status === "FAILED" ? "danger" : "neutral"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No workflow activity yet.</div>
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Workspace intelligence</p>
              <h2>Freshness, risk, recommendations, and recent activity</h2>
            </div>
            <span className="status-pill neutral">{workspaceIntelligence.totalWorkspaces} workspaces</span>
          </div>

          <div className="version-diff-stats">
            <div className="summary-item">
              <span>High risk</span>
              <strong>{workspaceIntelligence.highRisk}</strong>
            </div>
            <div className="summary-item">
              <span>Medium risk</span>
              <strong>{workspaceIntelligence.mediumRisk}</strong>
            </div>
            <div className="summary-item">
              <span>Low risk</span>
              <strong>{workspaceIntelligence.lowRisk}</strong>
            </div>
            <div className="summary-item">
              <span>Selected workspace</span>
              <strong>{selectedWorkspaceInsight?.name || "None"}</strong>
            </div>
          </div>

          <div className="admin-grid">
            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Risk board</p>
                  <h3>Workspace watchlist</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {workspaceIntelligence.workspaces.length > 0 ? (
                  workspaceIntelligence.workspaces.map((workspace) => (
                    <div className="admin-row" key={workspace.name}>
                      <div>
                        <strong>{workspace.name}</strong>
                        <span>
                          {joinMeta([
                            `Risk ${workspace.riskLevel}`,
                            workspace.freshnessDays === null ? "No freshness data" : `${workspace.freshnessDays} days old`,
                            `${workspace.linkedSkills.length} linked skills`,
                          ])}
                        </span>
                      </div>
                      <span
                        className={`status-pill ${
                          workspace.riskLevel === "high"
                            ? "danger"
                            : workspace.riskLevel === "medium"
                              ? "neutral"
                              : "success"
                        }`}
                      >
                        {titleCase(workspace.riskLevel)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No imported workspaces to analyze yet.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Recommendations</p>
                  <h3>Selected workspace intelligence</h3>
                </div>
              </div>
              {selectedWorkspaceInsight ? (
                <div className="admin-table compact-list">
                  {selectedWorkspaceInsight.riskSignals.map((signal) => (
                    <div className="admin-row" key={`${selectedWorkspaceInsight.name}:${signal.label}`}>
                      <div>
                        <strong>{signal.label}</strong>
                        <span>Risk signal detected for this imported workspace.</span>
                      </div>
                      <span className={`status-pill ${signal.severity === "high" ? "danger" : "neutral"}`}>
                        {titleCase(signal.severity)}
                      </span>
                    </div>
                  ))}
                  {selectedWorkspaceInsight.recommendedSkills.map((item) => (
                    <div className="admin-row" key={`${selectedWorkspaceInsight.name}:${item.skillName}`}>
                      <div>
                        <strong>{item.skillName}</strong>
                        <span>{joinMeta([item.reason, `Quality ${item.qualityStatus}`])}</span>
                      </div>
                      <span className="status-pill neutral">{Math.round(item.score * 100)}%</span>
                    </div>
                  ))}
                  {selectedWorkspaceInsight.recentActivity.map((item) => (
                    <div className="admin-row" key={`${selectedWorkspaceInsight.name}:${item.name}`}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{joinMeta([formatDate(new Date(item.updatedAt)), `${item.bytes} bytes`])}</span>
                      </div>
                      <span className="status-pill neutral">Recent</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Select or import a workspace to view recommendations and recent activity.</div>
              )}
            </section>
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Release operations</p>
              <h2>Demo mode and stable release snapshots</h2>
              <p className="muted-text">
                Seed presentation data, capture known-good states, and keep a lightweight release history inside the app.
              </p>
            </div>
            <span className="status-pill neutral">{releaseSnapshots.length} snapshots</span>
          </div>

          <div className="admin-actions">
            <form action={seedDemoData} className="inline-form">
              <button className="button secondary" type="submit">
                Seed demo data
              </button>
            </form>
            <form action={captureReleaseSnapshot} className="inline-form">
              <input className="search-field" type="text" name="label" placeholder="Stable snapshot label" />
              <button className="button primary" type="submit">
                Capture snapshot
              </button>
            </form>
          </div>

          <div className="admin-table compact-list">
            {releaseSnapshots.length > 0 ? (
              releaseSnapshots.map((snapshot) => (
                <div className="admin-row" key={snapshot.id}>
                  <div>
                    <strong>{snapshot.label}</strong>
                    <span>
                      {joinMeta([
                        snapshot.id,
                        snapshot.repository?.branch || "unknown branch",
                        snapshot.repository?.commit || "unknown commit",
                        formatDate(new Date(snapshot.createdAt)),
                      ])}
                    </span>
                    <span>
                      {joinMeta([
                        `${snapshot.skills?.total || 0} skills`,
                        `${snapshot.skills?.ready || 0} ready`,
                        `${snapshot.skills?.stable || 0} stable`,
                        `${snapshot.dependencyGraph?.edgeCount || 0} dependency links`,
                      ])}
                    </span>
                  </div>
                  <span className={`status-pill ${snapshot.repository?.dirty ? "danger" : "success"}`}>
                    {snapshot.repository?.dirty ? "Dirty" : "Clean"}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-state">No release snapshots captured yet.</div>
            )}
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Skill analytics</p>
              <h2>Library health, tags, and QA reporting</h2>
            </div>
            <span className="status-pill neutral">{skillInsights.totalSkills} skills</span>
          </div>

          <div className="version-diff-stats">
            <div className="summary-item">
              <span>Healthy skills</span>
              <strong>{skillInsights.healthSummary.passed || 0}</strong>
            </div>
            <div className="summary-item">
              <span>Warnings</span>
              <strong>{skillInsights.healthSummary.warning || 0}</strong>
            </div>
            <div className="summary-item">
              <span>Failures</span>
              <strong>{skillInsights.healthSummary.failed || 0}</strong>
            </div>
            <div className="summary-item">
              <span>Ready for use</span>
              <strong>{skillInsights.readySkills}</strong>
            </div>
            <div className="summary-item">
              <span>Owned skills</span>
              <strong>{skillInsights.ownedSkills}</strong>
            </div>
            <div className="summary-item">
              <span>Unowned skills</span>
              <strong>{skillInsights.unownedSkills}</strong>
            </div>
            <div className="summary-item">
              <span>Stale skills</span>
              <strong>{skillInsights.staleSkills}</strong>
            </div>
            <div className="summary-item">
              <span>Stable skills</span>
              <strong>{skillInsights.stableSkills}</strong>
            </div>
          </div>

          <div className="admin-grid">
            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Tag distribution</p>
                  <h3>Top library tags</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {topSkillTags.length > 0 ? (
                  topSkillTags.map((tag) => (
                    <div className="admin-row" key={tag.tag}>
                      <div>
                        <strong>{tag.tag}</strong>
                        <span>Skills carrying this tag</span>
                      </div>
                      <span className="status-pill neutral">{tag.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No skill tags recorded yet.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Ownership</p>
                  <h3>Top skill owners</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {topSkillOwners.length > 0 ? (
                  topSkillOwners.map((item) => (
                    <div className="admin-row" key={item.owner}>
                      <div>
                        <strong>{item.owner === "unassigned" ? "Unassigned" : item.owner}</strong>
                        <span>Skills owned by this person</span>
                      </div>
                      <span className="status-pill neutral">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No ownership data recorded yet.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Quality status</p>
                  <h3>Readiness by state</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {Object.entries(skillInsights.qualitySummary).length > 0 ? (
                  Object.entries(skillInsights.qualitySummary)
                    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                    .map(([status, count]) => (
                      <div className="admin-row" key={status}>
                        <div>
                          <strong>{formatAction(status)}</strong>
                          <span>Skills in this quality lane</span>
                        </div>
                        <span className="status-pill neutral">{count}</span>
                      </div>
                    ))
                ) : (
                  <div className="empty-state">No quality status data yet.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Scorecard</p>
                  <h3>Grade distribution</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {Object.entries(skillInsights.scoreGradeSummary).length > 0 ? (
                  Object.entries(skillInsights.scoreGradeSummary)
                    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                    .map(([grade, count]) => (
                      <div className="admin-row" key={grade}>
                        <div>
                          <strong>{`Grade ${grade}`}</strong>
                          <span>Skills in this score band</span>
                        </div>
                        <span className="status-pill neutral">{count}</span>
                      </div>
                    ))
                ) : (
                  <div className="empty-state">No scorecard data yet.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Stability</p>
                  <h3>Stable set and watchlist</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {Object.entries(skillInsights.stabilitySummary).length > 0 ? (
                  Object.entries(skillInsights.stabilitySummary)
                    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                    .map(([status, count]) => (
                      <div className="admin-row" key={status}>
                        <div>
                          <strong>{formatAction(status)}</strong>
                          <span>Skills in this stability lane</span>
                        </div>
                        <span className="status-pill neutral">{count}</span>
                      </div>
                    ))
                ) : (
                  <div className="empty-state">No stability data yet.</div>
                )}
              </div>
              <div className="admin-table compact-list">
                {topStableSkills.length > 0 ? (
                  topStableSkills.map((skill) => (
                    <div className="admin-row" key={skill.name}>
                      <div>
                        <strong>{skill.name}</strong>
                        <span>
                          {joinMeta([
                            `Grade ${skill.scorecard.grade}`,
                            `${skill.scorecard.score}/100`,
                            skill.owner ? `Owner ${skill.owner}` : "Owner missing",
                            `Freshness ${skill.freshnessStatus}`,
                          ])}
                        </span>
                      </div>
                      <a className="button secondary compact" href={`/skills/${encodeURIComponent(skill.name)}`}>
                        Open
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No stable skills identified yet.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Needs attention</p>
                  <h3>At-risk skills</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {atRiskSkills.length > 0 ? (
                  atRiskSkills.map((skill) => (
                    <div className="admin-row" key={skill.name}>
                      <div>
                        <strong>{skill.name}</strong>
                        <span>
                          {joinMeta([
                            skill.owner ? `Owner ${skill.owner}` : "Owner missing",
                            `Freshness ${skill.freshnessStatus}`,
                            `Health ${skill.healthStatus}`,
                            `Quality ${skill.qualityStatus}`,
                            skill.scorecard ? `Grade ${skill.scorecard.grade}` : "",
                            `${skill.validationSummary.failCount} fails`,
                            `${skill.validationSummary.warnCount} warnings`,
                          ])}
                        </span>
                      </div>
                      <a className="button secondary compact" href={`/skills/${encodeURIComponent(skill.name)}`}>
                        Open
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No at-risk skills right now.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Freshness</p>
                  <h3>Stale skills</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {staleSkills.length > 0 ? (
                  staleSkills.map((skill) => (
                    <div className="admin-row" key={skill.name}>
                      <div>
                        <strong>{skill.name}</strong>
                        <span>
                          {joinMeta([
                            skill.owner ? `Owner ${skill.owner}` : "Owner missing",
                            skill.lastAuditedAt ? `Audited ${formatDate(new Date(skill.lastAuditedAt))}` : "Never audited",
                            typeof skill.freshnessAgeDays === "number" ? `${skill.freshnessAgeDays} days old` : "",
                          ])}
                        </span>
                      </div>
                      <a className="button secondary compact" href={`/skills/${encodeURIComponent(skill.name)}`}>
                        Open
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No stale skills right now.</div>
                )}
              </div>
            </section>

            <section className="admin-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">QA reporting</p>
                  <h3>Recent validation reports</h3>
                </div>
              </div>
              <div className="admin-table compact-list">
                {latestQaReports.length > 0 ? (
                  latestQaReports.map((skill) => (
                    <div className="admin-row" key={skill.name}>
                      <div>
                        <strong>{skill.name}</strong>
                        <span>
                          {joinMeta([
                            skill.latestQaReport.recommendation,
                            `${skill.latestQaReport.findingsCount} findings`,
                            formatDate(new Date(skill.latestQaReport.createdAt)),
                          ])}
                        </span>
                      </div>
                      <a
                        className="button secondary compact"
                        href={`/api/skills/${encodeURIComponent(skill.name)}/qa-report`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View report
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No QA reports generated yet.</div>
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="admin-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Team</p>
              <h2>Users and roles</h2>
            </div>
          </div>
          <div className="admin-table">
            {users.map((user) => (
              <div className="admin-row" key={user.id}>
                <div>
                  <strong>{user.name || user.email}</strong>
                  <span>
                    {joinMeta([
                      user.email,
                      user.externalUserId ? `External ${user.externalUserId}` : "No external id",
                      user.preferredBranch ? `Branch ${user.preferredBranch}` : "No branch assigned",
                      user.lastSeenAt ? `Seen ${formatDate(user.lastSeenAt)}` : "Never seen",
                      `Updated ${formatDate(user.updatedAt)}`,
                    ])}
                  </span>
                  <form action={setUserExternalIdentity} className="inline-form">
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      className="search-field"
                      type="text"
                      name="externalUserId"
                      defaultValue={user.externalUserId || ""}
                      placeholder="user-1"
                    />
                    <button className="button secondary compact" type="submit">
                      Save external ID
                    </button>
                  </form>
                  <form action={setUserPreferredBranch} className="inline-form">
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      className="search-field"
                      type="text"
                      name="preferredBranch"
                      defaultValue={user.preferredBranch || ""}
                      placeholder="users/sanay"
                    />
                    <button className="button secondary compact" type="submit">
                      Save branch
                    </button>
                  </form>
                </div>
                <div className="admin-actions">
                  <span className={`status-pill ${user.role === "ADMIN" ? "success" : "neutral"}`}>{user.role}</span>
                  <span className={`status-pill ${userStatusClass(user.status)}`}>{user.status}</span>
                  {user.status !== "ACTIVE" ? (
                    <form action={setUserStatus}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="status" value="ACTIVE" />
                      <button className="button primary compact" type="submit">
                        Approve
                      </button>
                    </form>
                  ) : null}
                  {user.status !== "DISABLED" ? (
                    <form action={setUserStatus}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="status" value="DISABLED" />
                      <button className="button secondary compact" type="submit">
                        Disable
                      </button>
                    </form>
                  ) : (
                    <form action={setUserStatus}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="status" value="ACTIVE" />
                      <button className="button secondary compact" type="submit">
                        Reactivate
                      </button>
                    </form>
                  )}
                  <form action={setUserRole}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="role" value={user.role === "ADMIN" ? "USER" : "ADMIN"} />
                    <button className="button secondary compact" type="submit">
                      Make {user.role === "ADMIN" ? "User" : "Admin"}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">User activity</p>
              <h2>Who touched what</h2>
            </div>
            <span className="status-pill neutral">{userActivity.length} active users</span>
          </div>
          <div className="admin-table">
            {userActivity.length > 0 ? (
              userActivity.map((entry) => (
                <div className="admin-row" key={entry.user.id}>
                  <div>
                    <strong>{entry.user.name || entry.user.email || entry.user.id}</strong>
                    <span>
                      {joinMeta([
                        `${entry.totalActions} actions`,
                        entry.lastActionAt ? `Last activity ${formatDate(entry.lastActionAt)}` : "",
                      ])}
                    </span>
                    <span>
                      {joinMeta([
                        entry.touchedSkills.size
                          ? `Skills: ${Array.from(entry.touchedSkills).slice(0, 3).join(", ")}${
                              entry.touchedSkills.size > 3 ? ` +${entry.touchedSkills.size - 3}` : ""
                            }`
                          : "",
                        entry.touchedWorkflows.size
                          ? `Workflows: ${Array.from(entry.touchedWorkflows).slice(0, 2).join(", ")}${
                              entry.touchedWorkflows.size > 2 ? ` +${entry.touchedWorkflows.size - 2}` : ""
                            }`
                          : "",
                        entry.touchedWorkspaces.size
                          ? `Workspaces: ${Array.from(entry.touchedWorkspaces).slice(0, 2).join(", ")}${
                              entry.touchedWorkspaces.size > 2 ? ` +${entry.touchedWorkspaces.size - 2}` : ""
                            }`
                          : "",
                      ])}
                    </span>
                  </div>
                  <div className="admin-actions">
                    <span className="status-pill neutral">
                      {Array.from(entry.recentActions).slice(0, 2).map(formatAction).join(" / ")}
                    </span>
                    <a className="button secondary compact" href={`/admin?userId=${encodeURIComponent(entry.user.id)}`}>
                      Filter logs
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No user activity history has been recorded yet.</div>
            )}
          </div>
        </section>

        <section className="admin-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Security trail</p>
              <h2>Recent audit logs</h2>
            </div>
          </div>
          <div className="admin-table">
            {auditLogs.map((log) => (
              <div className="admin-row" key={log.id}>
                <div>
                  <strong>{formatAction(log.action)}</strong>
                  <span>
                    {joinMeta([
                      log.user?.name || log.user?.email || log.userId,
                      `${log.resource}:${log.resourceId}`,
                    ])}
                  </span>
                </div>
                <span>{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Audit summary</p>
              <h2>Top actions</h2>
            </div>
          </div>
          <div className="admin-table compact-list">
            {auditActionGroups.map((group) => (
              <div className="admin-row" key={group.action}>
                <div>
                  <strong>{formatAction(group.action)}</strong>
                  <span>{group.action}</span>
                </div>
                <span className="status-pill neutral">{group._count.action}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Notification summary</p>
              <h2>By type</h2>
            </div>
          </div>
          <div className="admin-table compact-list">
            {notificationTypeGroups.map((group) => (
              <div className="admin-row" key={group.type}>
                <div>
                  <strong>{formatAction(group.type)}</strong>
                  <span>{group.type}</span>
                </div>
                <span className="status-pill neutral">{group._count.type}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Delivery</p>
              <h2>Recent notifications and email status</h2>
            </div>
            <form action={markAllNotificationsRead}>
              <button className="button secondary compact" type="submit" disabled={unreadNotificationCount === 0}>
                Mark all read
              </button>
            </form>
          </div>
          <div className="admin-table">
            {notifications.map((notification) => (
              <div className="admin-row" key={notification.id}>
                <div>
                  <strong>{notification.title}</strong>
                  <span>
                    Attempts: {notification.retryCount || 0}
                    {notification.lastAttemptAt ? ` | Last attempt ${formatDate(notification.lastAttemptAt)}` : ""}
                    {notification.emailError ? ` | Error: ${notification.emailError}` : ""}
                  </span>
                  <span>
                    {joinMeta([notification.user?.email || notification.userId, notification.message])}
                  </span>
                </div>
                <div className="admin-actions">
                  <span className={`status-pill ${emailStatusClass(notification.emailStatus)}`}>
                    {notification.emailStatus || (notification.emailSent ? "SENT" : "PENDING")}
                  </span>
                  <span className={`status-pill ${notification.read ? "neutral" : "danger"}`}>
                    {notification.read ? "READ" : "UNREAD"}
                  </span>
                  {!notification.read ? (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button className="button secondary compact" type="submit">
                        Mark read
                      </button>
                    </form>
                  ) : null}
                  {canResendEmail(notification.emailStatus, notification.auditLogId) ? (
                    <form action={resendEmail}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button className="button secondary compact" type="submit">
                        Resend
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
