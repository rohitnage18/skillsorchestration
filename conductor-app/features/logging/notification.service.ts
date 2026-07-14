import nodemailer from "nodemailer";
import {
  AuditLog,
  Notification,
  NotificationType,
  PrismaClient,
  User,
} from "../../lib/generated/prisma/client";

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
}

export class NotificationService {
  private emailConfig: EmailConfig | null = null;

  constructor(private prisma: PrismaClient) {
    this.initializeEmailConfig();
  }

  private initializeEmailConfig() {
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.FROM_EMAIL
    ) {
      this.emailConfig = {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: Number(process.env.SMTP_PORT ?? 587),
        smtpSecure: process.env.SMTP_SECURE === "true",
        smtpUser: process.env.SMTP_USER,
        smtpPassword: process.env.SMTP_PASSWORD,
        fromEmail: process.env.FROM_EMAIL,
      };
    }
  }

  async notifyAdmins(auditLog: AuditLog) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: "ADMIN" },
      });

      if (admins.length === 0) {
        return;
      }

      const notificationType = this.mapActionToNotificationType(auditLog.action);
      const actor = await this.prisma.user.findUnique({
        where: { id: auditLog.userId },
      });
      const actorName = actor?.name || actor?.email || auditLog.userId;
      const initialEmailStatus = this.getInitialEmailStatus(auditLog.action);

      const notifications = await Promise.all(
        admins.map((admin) =>
          this.prisma.notification.create({
            data: {
              userId: admin.id,
              title: this.getNotificationTitle(auditLog.action),
              message: this.getNotificationMessage(
                auditLog.action,
                actorName,
                auditLog.resource,
                auditLog.resourceId
              ),
              type: notificationType,
              auditLogId: auditLog.id,
              emailStatus: initialEmailStatus,
            },
          })
        )
      );

      if (initialEmailStatus !== "PENDING") {
        return;
      }

      await Promise.all(
        admins.map(async (admin) => {
          const notification = notifications.find((item) => item.userId === admin.id);
          if (!notification) {
            return;
          }

          try {
            await this.sendNotificationEmail(notification, admin, auditLog, actorName);
          } catch (error) {
            console.error(`Failed to send email to ${admin.email}:`, error);
          }
        })
      );
    } catch (error) {
      console.error("Failed to notify admins:", error);
    }
  }

  async resendNotificationEmail(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: true },
    });

    if (!notification) {
      throw new Error("Notification not found.");
    }

    if (!notification.auditLogId) {
      throw new Error("Notification is not linked to an audit log.");
    }

    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id: notification.auditLogId },
    });

    if (!auditLog) {
      throw new Error("Linked audit log not found.");
    }

    if (this.shouldSkipEmail(auditLog.action)) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailStatus: "SKIPPED",
          emailError: "Email notification is intentionally skipped for this action.",
        },
      });
      throw new Error("Email notification is skipped for this action.");
    }

    if (!this.emailConfig) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailStatus: "NOT_CONFIGURED",
          emailError: "SMTP configuration is missing.",
          lastAttemptAt: new Date(),
        },
      });
      throw new Error("SMTP configuration is missing.");
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: auditLog.userId },
    });
    const actorName = actor?.name || actor?.email || auditLog.userId;

    return this.sendNotificationEmail(notification, notification.user, auditLog, actorName);
  }

  private getInitialEmailStatus(action: string) {
    if (this.shouldSkipEmail(action)) {
      return "SKIPPED" as const;
    }

    if (!this.emailConfig) {
      return "NOT_CONFIGURED" as const;
    }

    return "PENDING" as const;
  }

  private async sendNotificationEmail(
    notification: Notification,
    recipient: Pick<User, "email">,
    auditLog: AuditLog,
    actorName: string
  ) {
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        emailStatus: "PENDING",
        emailError: null,
        lastAttemptAt: new Date(),
        retryCount: { increment: 1 },
      },
    });

    try {
      const email = this.getEmailContent(auditLog, actorName);
      await this.sendEmail(recipient.email, email.subject, email.html, email.text);

      return this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailSent: true,
          emailStatus: "SENT",
          emailError: null,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailStatus: "FAILED",
          emailError: formatError(error),
        },
      });
      throw error;
    }
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.emailConfig) {
      return;
    }

    const transporter = nodemailer.createTransport({
      host: this.emailConfig.smtpHost,
      port: this.emailConfig.smtpPort,
      secure: this.emailConfig.smtpSecure,
      auth: {
        user: this.emailConfig.smtpUser,
        pass: this.emailConfig.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: this.emailConfig.fromEmail,
      to,
      subject,
      html,
      text,
    });
  }

  async getNotifications(
    userId: string,
    filters?: {
      read?: boolean;
      type?: NotificationType;
      limit?: number;
      offset?: number;
    }
  ) {
    const { read, type, limit = 50, offset = 0 } = filters || {};

    const where: any = { userId };
    if (read !== undefined) where.read = read;
    if (type) where.type = type;

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async clearOldNotifications(olderThanDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        read: true,
      },
    });
  }

  private mapActionToNotificationType(action: string): NotificationType {
    const typeMap: Record<string, NotificationType> = {
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
      "user:status:update": "USER_ACTION",
      "auth:status-denied": "USER_ACTION",
    };
    return typeMap[action] || "USER_ACTION";
  }

  private shouldSkipEmail(action: string): boolean {
    return action === "skill:list";
  }

  private getNotificationTitle(action: string): string {
    const titleMap: Record<string, string> = {
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
      "user:status:update": "User Status Updated",
      "auth:status-denied": "Inactive User Blocked",
    };
    return titleMap[action] || "System Action";
  }

  private getNotificationMessage(
    action: string,
    actorName: string,
    resource: string,
    resourceId: string
  ): string {
    return `${actorName} performed ${action} on ${resource} (${resourceId})`;
  }

  private getEmailContent(auditLog: AuditLog, actorName: string) {
    const title = this.getNotificationTitle(auditLog.action);
    const actionLabel = this.getActionLabel(auditLog.action);
    const metadata = toRecord(auditLog.metadata);
    const changes = toRecord(auditLog.changes);
    const skillName = getStringValue(metadata.skillName) || auditLog.resourceId;
    const source = getStringValue(metadata.source) || "Conductor Studio";
    const time = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(auditLog.createdAt);
    const subject = `[Conductor] ${title}: ${skillName}`;
    const details = [
      ["Actor", actorName],
      ["Action", actionLabel],
      ["Skill", skillName],
      ["Source", source],
      ["Time", `${time} UTC`],
    ];
    const metadataRows = Object.entries(metadata).filter(
      ([key]) => !["skillName", "source"].includes(key)
    );
    const changeRows = Object.entries(changes);

    const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#f6f8fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fb;padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a,#2563eb);padding:28px 32px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.78;">Conductor Studio</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${escapeHtml(title)}</h1>
                <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">A skill activity was recorded for your workspace.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
                  ${details
                    .map(
                      ([label, value]) => `
                  <tr>
                    <td style="width:130px;color:#64748b;font-size:13px;font-weight:600;padding:10px 0;border-bottom:1px solid #f1f5f9;">${escapeHtml(label)}</td>
                    <td style="color:#0f172a;font-size:14px;padding:10px 0;border-bottom:1px solid #f1f5f9;">${escapeHtml(value)}</td>
                  </tr>`
                    )
                    .join("")}
                </table>

                ${
                  metadataRows.length
                    ? `<div style="margin-top:24px;">
                  <h2 style="margin:0 0 12px;font-size:15px;color:#0f172a;">Additional context</h2>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;">
                    ${metadataRows
                      .map(
                        ([key, value]) => `
                    <tr>
                      <td style="color:#64748b;font-size:13px;font-weight:600;padding:8px 10px;width:140px;">${escapeHtml(formatLabel(key))}</td>
                      <td style="color:#0f172a;font-size:13px;padding:8px 10px;">${escapeHtml(formatValue(value))}</td>
                    </tr>`
                      )
                      .join("")}
                  </table>
                </div>`
                    : ""
                }

                ${
                  changeRows.length
                    ? `<div style="margin-top:24px;">
                  <h2 style="margin:0 0 12px;font-size:15px;color:#0f172a;">Change summary</h2>
                  <pre style="white-space:pre-wrap;background:#0f172a;color:#e2e8f0;border-radius:14px;padding:16px;font-size:12px;line-height:1.55;overflow:auto;">${escapeHtml(JSON.stringify(changes, null, 2))}</pre>
                </div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;color:#64748b;font-size:12px;">
                This notification was generated automatically by Conductor Studio. Review audit logs in the admin dashboard for full history.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const textSections = [
      `Conductor Studio - ${title}`,
      "",
      ...details.map(([label, value]) => `${label}: ${value}`),
      ...(metadataRows.length
        ? ["", "Additional context:", ...metadataRows.map(([key, value]) => `${formatLabel(key)}: ${formatValue(value)}`)]
        : []),
      ...(changeRows.length ? ["", "Change summary:", JSON.stringify(changes, null, 2)] : []),
      "",
      "Review audit logs in the admin dashboard for full history.",
    ];

    return {
      subject,
      html,
      text: textSections.join("\n"),
    };
  }

  private getActionLabel(action: string) {
    const labelMap: Record<string, string> = {
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
      "user:status:update": "User status updated",
      "auth:status-denied": "Inactive user blocked",
    };
    return labelMap[action] || action;
  }
}

let notificationService: NotificationService;

export const initializeNotificationService = (prisma: PrismaClient) => {
  notificationService = new NotificationService(prisma);
  return notificationService;
};

export { notificationService };

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}
