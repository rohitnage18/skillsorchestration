import { PrismaClient } from "../../lib/generated/prisma/client";
import { notificationService } from "./notification.service";

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class AuditLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log an action to the audit log
   * Automatically creates notifications for admins
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const auditLog = await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          changes: entry.changes,
          metadata: entry.metadata,
        },
      });

      // Notify admins about this action
      await notificationService.notifyAdmins(auditLog);
    } catch (error) {
      console.error("Failed to log audit entry:", error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Get audit logs with optional filtering
   */
  async getLogs(filters: {
    userId?: string;
    resource?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const { userId, resource, action, limit = 100, offset = 0 } = filters;

    const where: any = {};
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (action) where.action = action;

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get audit log statistics for dashboard
   */
  async getStats(timeframe: "day" | "week" | "month" = "week") {
    const now = new Date();
    const startDate = new Date();

    if (timeframe === "day") startDate.setDate(now.getDate() - 1);
    if (timeframe === "week") startDate.setDate(now.getDate() - 7);
    if (timeframe === "month") startDate.setMonth(now.getMonth() - 1);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: startDate },
      },
    });

    // Group by action
    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    logs.forEach((log) => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byResource[log.resource] = (byResource[log.resource] || 0) + 1;
      byUser[log.userId] = (byUser[log.userId] || 0) + 1;
    });

    return { byAction, byResource, byUser, total: logs.length };
  }

  /**
   * Clean up old logs (if retention policy changes)
   */
  async purgeLogs(olderThanDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
  }
}
