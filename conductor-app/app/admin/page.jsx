import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth.js";
import { db } from "../../lib/db";
import {
  approveSkillChangeRequest,
  rejectSkillChangeRequest,
} from "../../lib/skillChangeRequests.js";
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
  if (!userId || !["PENDING", "ACTIVE", "DISABLED"].includes(status)) {
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

export default async function AdminDashboardPage({ searchParams }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <section className="admin-shell">
        <div className="empty-state">
          <h1>{session.user.status === "PENDING" ? "Approval pending" : "Admin access required"}</h1>
          <p>
            {session.user.status === "PENDING"
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

  const [
    users,
    auditLogs,
    notifications,
    pendingRequests,
    reviewedRequests,
    auditActionGroups,
    notificationTypeGroups,
    userCount,
    adminCount,
    normalUserCount,
    pendingUserCount,
    disabledUserCount,
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
  ] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        updatedAt: true,
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
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { role: "USER" } }),
    db.user.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { status: "DISABLED" } }),
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
  ]);

  const deliverableEmailCount = sentEmailCount + failedEmailCount + pendingEmailCount;
  const emailDeliveryRate =
    deliverableEmailCount > 0 ? Math.round((sentEmailCount / deliverableEmailCount) * 100) : 0;

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
          <span>{adminCount} admin / {normalUserCount} user</span>
          <span>{pendingUserCount} pending / {disabledUserCount} disabled</span>
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
          <span>{sentEmailCount} sent / {failedEmailCount} failed / {pendingEmailCount} pending</span>
          <span>{skippedEmailCount} skipped / {notConfiguredEmailCount} not configured</span>
        </div>
        <div className="metric-card">
          <p>Approvals</p>
          <strong>{pendingRequestCount}</strong>
          <span>{approvedRequestCount} approved / {rejectedRequestCount} rejected</span>
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
                      {request.requestedBy?.name || request.requestedBy?.email || request.requestedById} · {request.type} ·{" "}
                      {formatDate(request.createdAt)}
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
                      Requested by {request.requestedBy?.name || request.requestedBy?.email || request.requestedById} · Reviewed by{" "}
                      {request.reviewedBy?.name || request.reviewedBy?.email || "unknown"} ·{" "}
                      {request.reviewedAt ? formatDate(request.reviewedAt) : "No review time"}
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
                  <span>{user.email} · Updated {formatDate(user.updatedAt)}</span>
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
                    {(log.user?.name || log.user?.email || log.userId)} · {log.resource}:{log.resourceId}
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
                    {notification.lastAttemptAt ? ` - Last attempt ${formatDate(notification.lastAttemptAt)}` : ""}
                    {notification.emailError ? ` - Error: ${notification.emailError}` : ""}
                  </span>
                  <span>
                    {notification.user?.email || notification.userId} · {notification.message}
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
