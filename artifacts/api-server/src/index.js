import app from './app.js';
import { logger } from './lib/logger.js';
import { initFirebase } from './providers/firebase/firebase.provider.js';
import { initMail } from './providers/mail/mail.provider.js';
import { initPdf } from './providers/pdf/pdf.provider.js';

const rawPort = process.env['PORT'];
if (!rawPort) {
  logger.error('PORT environment variable is required');
  process.exit(1);
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  logger.error({ rawPort }, 'Invalid PORT value');
  process.exit(1);
}

// ─── Initialise providers (non-blocking — failures are graceful) ───────────
await initFirebase();
await initMail();
await initPdf();

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    logger.error({ err }, 'Error starting server');
    process.exit(1);
  }
  logger.info({ port, env: process.env['NODE_ENV'] ?? 'development' }, 'SAS Platform API server started');
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});
