import { PrismaClient, NotificationType, AuditLog } from "@prisma/client";

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
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
    // Email configuration from environment variables
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.FROM_EMAIL
    ) {
      this.emailConfig = {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: parseInt(process.env.SMTP_PORT),
        smtpUser: process.env.SMTP_USER,
        smtpPassword: process.env.SMTP_PASSWORD,
        fromEmail: process.env.FROM_EMAIL,
      };
    }
  }

  /**
   * Notify admins about an audit log entry
   */
  async notifyAdmins(auditLog: AuditLog) {
    try {
      // Get all admin users
      const admins = await this.prisma.user.findMany({
        where: { role: "ADMIN" },
      });

      if (admins.length === 0) return;

      // Map action to notification type
      const notificationType = this.mapActionToNotificationType(auditLog.action);

      // Get user who performed the action
      const actor = await this.prisma.user.findUnique({
        where: { id: auditLog.userId },
      });

      // Create notification for each admin
      const notifications = await Promise.all(
        admins.map((admin) =>
          this.prisma.notification.create({
            data: {
              userId: admin.id,
              title: this.getNotificationTitle(auditLog.action),
              message: this.getNotificationMessage(
                auditLog.action,
                actor?.name || "Unknown",
                auditLog.resource,
                auditLog.resourceId
              ),
              type: notificationType,
              auditLogId: auditLog.id,
            },
          })
        )
      );

      // Send emails
      if (this.emailConfig) {
        await Promise.all(
          admins.map((admin) =>
            this.sendEmail(
              admin.email,
              this.getNotificationTitle(auditLog.action),
              this.getEmailBody(auditLog, actor?.name || "Unknown")
            ).catch((error) =>
              console.error(`Failed to send email to ${admin.email}:`, error)
            )
          )
        );

        // Mark emails as sent
        await this.prisma.notification.updateMany({
          where: { id: { in: notifications.map((n) => n.id) } },
          data: { emailSent: true, sentAt: new Date() },
        });
      }
    } catch (error) {
      console.error("Failed to notify admins:", error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    if (!this.emailConfig) {
      console.warn("Email config not initialized, skipping email send");
      return;
    }

    // Use nodemailer or similar library to send email
    // This is a placeholder - implement with your preferred email service
    try {
      // Example using a hypothetical email service
      // In production, use nodemailer, SendGrid, AWS SES, etc.
      console.log(`[EMAIL] To: ${to}`);
      console.log(`[EMAIL] Subject: ${subject}`);
      console.log(`[EMAIL] Body: ${body}`);

      // For now, just log it - actual implementation depends on your email provider
      // Example with nodemailer:
      /*
      const transporter = nodemailer.createTransport({
        host: this.emailConfig.smtpHost,
        port: this.emailConfig.smtpPort,
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
      });
      */
    } catch (error) {
      console.error("Email send failed:", error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
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

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /**
   * Clear old notifications
   */
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

  // Helper methods
  private mapActionToNotificationType(action: string): NotificationType {
    const typeMap: Record<string, NotificationType> = {
      "skill:create": "SKILL_CREATED",
      "skill:update": "SKILL_UPDATED",
      "skill:delete": "SKILL_DELETED",
      "workflow:create": "WORKFLOW_CREATED",
      "workflow:update": "WORKFLOW_UPDATED",
      "workflow:delete": "WORKFLOW_DELETED",
      "workflow:run:start": "WORKFLOW_RUN_STARTED",
      "workflow:run:complete": "WORKFLOW_RUN_COMPLETED",
      "workflow:run:fail": "WORKFLOW_RUN_FAILED",
    };
    return typeMap[action] || "USER_ACTION";
  }

  private getNotificationTitle(action: string): string {
    const titleMap: Record<string, string> = {
      "skill:create": "New Skill Created",
      "skill:update": "Skill Updated",
      "skill:delete": "Skill Deleted",
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
    return `${actorName} ${action} ${resource} (${resourceId})`;
  }

  private getEmailBody(auditLog: AuditLog, actorName: string): string {
    return `
      <h2>${this.getNotificationTitle(auditLog.action)}</h2>
      <p><strong>Actor:</strong> ${actorName}</p>
      <p><strong>Resource:</strong> ${auditLog.resource}</p>
      <p><strong>Resource ID:</strong> ${auditLog.resourceId}</p>
      <p><strong>Time:</strong> ${auditLog.createdAt.toLocaleString()}</p>
      ${
        auditLog.changes
          ? `<p><strong>Changes:</strong> <pre>${JSON.stringify(auditLog.changes, null, 2)}</pre></p>`
          : ""
      }
    `;
  }
}

// Singleton instance
let notificationService: NotificationService;

export const initializeNotificationService = (prisma: PrismaClient) => {
  notificationService = new NotificationService(prisma);
  return notificationService;
};

export { notificationService };
