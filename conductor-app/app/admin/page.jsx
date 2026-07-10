import { redirect } from "next/navigation";
import { auth } from "../../auth.js";
import { db } from "../../lib/db";

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <section className="admin-shell">
        <div className="empty-state">
          <h1>Admin access required</h1>
          <p>Your account is signed in, but it is not marked as `ADMIN` in Prisma.</p>
        </div>
      </section>
    );
  }

  const [users, auditLogs, notifications, userCount, logCount, notificationCount, sentEmailCount] =
    await Promise.all([
      db.user.findMany({
        orderBy: [{ role: "asc" }, { email: "asc" }],
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          updatedAt: true,
        },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
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
      db.user.count(),
      db.auditLog.count(),
      db.notification.count(),
      db.notification.count({ where: { emailSent: true } }),
    ]);

  const unsentEmailCount = notificationCount - sentEmailCount;

  return (
    <section className="admin-shell">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Admin command center</p>
          <h1>Users, audit logs, notifications, and email delivery</h1>
        </div>
        <span className="status-pill success">Signed in as {session.user.email}</span>
      </div>

      <div className="admin-metrics">
        <div className="metric-card">
          <p>Users</p>
          <strong>{userCount}</strong>
        </div>
        <div className="metric-card">
          <p>Audit logs</p>
          <strong>{logCount}</strong>
        </div>
        <div className="metric-card">
          <p>Notifications</p>
          <strong>{notificationCount}</strong>
        </div>
        <div className="metric-card">
          <p>Email sent / not sent</p>
          <strong>
            {sentEmailCount} / {unsentEmailCount}
          </strong>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Team</p>
              <h2>Users</h2>
            </div>
          </div>
          <div className="admin-table">
            {users.map((user) => (
              <div className="admin-row" key={user.id}>
                <div>
                  <strong>{user.name || user.email}</strong>
                  <span>{user.email}</span>
                </div>
                <span className={`status-pill ${user.role === "ADMIN" ? "success" : ""}`}>{user.role}</span>
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
                  <strong>{log.action}</strong>
                  <span>
                    {(log.user?.name || log.user?.email || log.userId)} · {log.resource}:{log.resourceId}
                  </span>
                </div>
                <span>{formatDate(log.createdAt)}</span>
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
          </div>
          <div className="admin-table">
            {notifications.map((notification) => (
              <div className="admin-row" key={notification.id}>
                <div>
                  <strong>{notification.title}</strong>
                  <span>
                    {notification.user?.email || notification.userId} · {notification.message}
                  </span>
                </div>
                <span className={`status-pill ${notification.emailSent ? "success" : ""}`}>
                  {notification.emailSent ? "EMAIL SENT" : "NO EMAIL"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
