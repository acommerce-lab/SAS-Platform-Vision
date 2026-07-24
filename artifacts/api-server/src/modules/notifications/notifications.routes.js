import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { listNotifications, markRead, markAllRead } from './notifications.service.js';

const router = Router();

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const { unread_only, page, limit } = req.query;
    res.json(await listNotifications({
      userId: req.user.id,
      userRole: req.user.role,
      unread_only: unread_only === 'true',
      page: page ? +page : 1,
      limit: limit ? +limit : 30,
    }));
  } catch (err) { next(err); }
});

router.patch('/notifications/:notificationId/read', requireAuth, async (req, res, next) => {
  try { res.json(await markRead(req.params.notificationId, req.user.id)); } catch (err) { next(err); }
});

router.patch('/notifications/read-all', requireAuth, async (req, res, next) => {
  try { res.json(await markAllRead(req.user.id, req.user.role)); } catch (err) { next(err); }
});

export default router;
