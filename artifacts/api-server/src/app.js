import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { config } from './config/config.js';
import { logger } from './lib/logger.js';
import { correlationMiddleware } from './middlewares/correlation.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import router from './routes/index.js';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    },
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: true,           // Reflect origin (tightened in production via env)
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    exposedHeaders: ['X-Correlation-ID'],
  }),
);

// ─── Request Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Correlation ID ───────────────────────────────────────────────────────────
app.use(correlationMiddleware);

// ─── HTTP Logging ─────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    customLogLevel(_req, res) {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    // Don't log health checks
    autoLogging: {
      ignore: (req) => req.url === '/api/v1/healthz',
    },
  }),
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', router);

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
