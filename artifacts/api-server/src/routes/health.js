import { Router } from 'express';

const router = Router();

router.get('/v1/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
