import prisma from '../../../../../lib/db/src/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/error-codes.js';

export async function listNotifications({ userId, userRole, unread_only, page = 1, limit = 30 }) {
  const where = {
    user_id: userId,
    user_role: userRole.toUpperCase(),
    ...(unread_only ? { is_read: false } : {}),
  };

  const [data, total, unread_count] = await Promise.all([
    prisma.notification.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { created_at: 'desc' } }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { user_id: userId, user_role: userRole.toUpperCase(), is_read: false } }),
  ]);

  return { data: data.map(fmt), total, unread_count, page, limit };
}

export async function markRead(notificationId, userId) {
  const n = await prisma.notification.findFirst({ where: { id: notificationId, user_id: userId } });
  if (!n) throw new AppError(ErrorCodes.NOTIFICATION_NOT_FOUND, 'Notification not found');
  const updated = await prisma.notification.update({ where: { id: notificationId }, data: { is_read: true } });
  return fmt(updated);
}

export async function markAllRead(userId, userRole) {
  await prisma.notification.updateMany({
    where: { user_id: userId, user_role: userRole.toUpperCase(), is_read: false },
    data: { is_read: true },
  });
  return { success: true };
}

function fmt(n) {
  return {
    id: n.id,
    user_id: n.user_id,
    user_role: n.user_role.toLowerCase(),
    title: n.title,
    message: n.message,
    related_shipment_id: n.related_shipment_id,
    is_read: n.is_read,
    created_at: n.created_at.toISOString(),
  };
}
