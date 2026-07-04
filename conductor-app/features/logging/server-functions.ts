"use server";

import { db } from "../../lib/db";
import { AuditLogService } from "./auditLog.service";
import { initializeNotificationService } from "./notification.service";

const auditLogService = new AuditLogService(db);
const notificationService = initializeNotificationService(db);

/**
 * Get audit logs with optional filtering
 * Admin only endpoint
 */
export async function getAuditLogs(filters: {
  userId?: string;
  resource?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const logs = await auditLogService.getLogs(filters);
    return { success: true, data: logs };
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return { success: false, error: "Failed to fetch audit logs" };
  }
}

/**
 * Get audit log statistics
 * Admin only endpoint
 */
export async function getAuditStats(
  timeframe: "day" | "week" | "month" = "week"
) {
  try {
    const stats = await auditLogService.getStats(timeframe);
    return { success: true, data: stats };
  } catch (error) {
    console.error("Failed to fetch audit stats:", error);
    return { success: false, error: "Failed to fetch audit stats" };
  }
}

/**
 * Get notifications for current user
 */
export async function getNotifications(userId: string, filters?: {
  read?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const notifications = await notificationService.getNotifications(userId, filters as any);
    return { success: true, data: notifications };
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return { success: false, error: "Failed to fetch notifications" };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const notification = await notificationService.markAsRead(notificationId);
    return { success: true, data: notification };
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return { success: false, error: "Failed to mark notification as read" };
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string) {
  try {
    const count = await notificationService.getUnreadCount(userId);
    return { success: true, data: { count } };
  } catch (error) {
    console.error("Failed to get unread count:", error);
    return { success: false, error: "Failed to get unread count" };
  }
}

/**
 * Log an action (used internally by skill/workflow operations)
 */
export async function logAction(entry: {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}) {
  try {
    await auditLogService.log(entry);
    return { success: true };
  } catch (error) {
    console.error("Failed to log action:", error);
    // Return success anyway - logging failures shouldn't break main operations
    return { success: true };
  }
}

/**
 * Cleanup: purge old audit logs
 * Admin only endpoint
 */
export async function purgeOldAuditLogs(olderThanDays: number) {
  try {
    const result = await auditLogService.purgeLogs(olderThanDays);
    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to purge audit logs:", error);
    return { success: false, error: "Failed to purge audit logs" };
  }
}

/**
 * Cleanup: clear old notifications
 */
export async function clearOldNotifications(olderThanDays: number) {
  try {
    const result = await notificationService.clearOldNotifications(olderThanDays);
    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to clear notifications:", error);
    return { success: false, error: "Failed to clear notifications" };
  }
}
