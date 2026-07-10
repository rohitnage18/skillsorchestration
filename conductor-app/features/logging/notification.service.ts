import nodemailer from "nodemailer";
import { AuditLog, NotificationType, PrismaClient } from "../../lib/generated/prisma/client";

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
            },
          })
        )
      );

      if (!this.emailConfig || this.shouldSkipEmail(auditLog.action)) {
        return;
      }

      await Promise.all(
        admins.map(async (admin) => {
          const notification = notifications.find((item) => item.userId === admin.id);
          try {
            await this.sendEmail(
              admin.email,
              this.getNotificationTitle(auditLog.action),
              this.getEmailBody(auditLog, actorName)
            );

            if (notification) {
              await this.prisma.notification.update({
                where: { id: notification.id },
                data: { emailSent: true, sentAt: new Date() },
              });
            }
          } catch (error) {
            console.error(`Failed to send email to ${admin.email}:`, error);
          }
        })
      );
    } catch (error) {
      console.error("Failed to notify admins:", error);
    }
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
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
      html: body,
      text: stripHtml(body),
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
      "skill:file:update": "USER_ACTION",
      "workflow:create": "WORKFLOW_CREATED",
      "workflow:update": "WORKFLOW_UPDATED",
      "workflow:delete": "WORKFLOW_DELETED",
      "workflow:run:start": "WORKFLOW_RUN_STARTED",
      "workflow:run:complete": "WORKFLOW_RUN_COMPLETED",
      "workflow:run:fail": "WORKFLOW_RUN_FAILED",
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
      "skill:file:update": "Skill File Updated",
      "workflow:create": "New Workflow Created",
      "workflow:update": "Workflow Updated",
      "workflow:delete": "Workflow Deleted",
      "workflow:run:start": "Workflow Execution Started",
      "workflow:run:complete": "Workflow Execution Completed",
      "workflow:run:fail": "Workflow Execution Failed",
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

  private getEmailBody(auditLog: AuditLog, actorName: string): string {
    const changes = auditLog.changes ? JSON.stringify(auditLog.changes, null, 2) : "";
    const metadata = auditLog.metadata ? JSON.stringify(auditLog.metadata, null, 2) : "";

    return `
      <h2>${escapeHtml(this.getNotificationTitle(auditLog.action))}</h2>
      <p><strong>Actor:</strong> ${escapeHtml(actorName)}</p>
      <p><strong>Action:</strong> ${escapeHtml(auditLog.action)}</p>
      <p><strong>Resource:</strong> ${escapeHtml(auditLog.resource)}</p>
      <p><strong>Resource ID:</strong> ${escapeHtml(auditLog.resourceId)}</p>
      <p><strong>Time:</strong> ${escapeHtml(auditLog.createdAt.toISOString())}</p>
      ${changes ? `<p><strong>Changes:</strong></p><pre>${escapeHtml(changes)}</pre>` : ""}
      ${metadata ? `<p><strong>Metadata:</strong></p><pre>${escapeHtml(metadata)}</pre>` : ""}
    `;
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

function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
