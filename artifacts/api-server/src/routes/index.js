import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from '../modules/identity/identity.routes.js';
import carriersRouter from '../modules/carriers/carriers.routes.js';
import shippersRouter from '../modules/shippers/shippers.routes.js';
import shipmentsRouter from '../modules/shipments/shipments.routes.js';
import notificationsRouter from '../modules/notifications/notifications.routes.js';
import conversationsRouter from '../modules/conversations/conversations.routes.js';
import supportRouter from '../modules/support/support.routes.js';

const router = Router();

// ─── Health ───────────────────────────────────────────────────────────────────
router.use(healthRouter);

// ─── API v1 ───────────────────────────────────────────────────────────────────
router.use('/v1/auth', authRouter);
router.use('/v1', carriersRouter);
router.use('/v1', shippersRouter);
router.use('/v1', shipmentsRouter);
router.use('/v1', notificationsRouter);
router.use('/v1', conversationsRouter);
router.use('/v1/support', supportRouter);

// ─── 404 catch-all ───────────────────────────────────────────────────────────
router.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'API endpoint not found' },
  });
});

export default router;
