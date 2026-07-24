/**
 * Email provider using Nodemailer.
 * Fails gracefully if SMTP is not configured.
 */

import { logger } from '../../lib/logger.js';
import { config } from '../../config/config.js';

let transporter = null;

export async function initMail() {
  const { host, port, user, password } = config.smtp;

  if (!host || !user || !password) {
    logger.warn('SMTP not configured — email sending disabled. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD.');
    return;
  }

  try {
    const { default: nodemailer } = await import('nodemailer');
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });

    await transporter.verify();
    logger.info({ host, port }, 'Mail transporter ready');
  } catch (err) {
    logger.error({ err }, 'Mail transporter setup failed — email sending disabled');
    transporter = null;
  }
}

/**
 * Send an email.
 * Silently skips if SMTP is not configured.
 *
 * @param {{ to: string, subject: string, html: string }} options
 */
export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    logger.warn({ to, subject }, 'Email skipped — SMTP not configured');
    return;
  }

  try {
    await transporter.sendMail({ from: config.smtp.from, to, subject, html });
    logger.info({ to, subject }, 'Email sent');
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send email');
  }
}

// ─── Email templates ───────────────────────────────────────────────────────

export function accountActivatedEmail(name) {
  return {
    subject: 'Your SAS Platform account has been activated',
    html: `<p>Hello ${name},</p><p>Your account has been activated. You can now log in to SAS Platform.</p>`,
  };
}

export function accountPendingEmail(name) {
  return {
    subject: 'Registration received — pending activation',
    html: `<p>Hello ${name},</p><p>Your registration has been received and is pending admin review. You will be notified once your account is activated.</p>`,
  };
}

export function pricingSentEmail(name, shipmentRef, price, currency) {
  return {
    subject: `Pricing ready for shipment ${shipmentRef}`,
    html: `<p>Hello ${name},</p><p>Pricing for shipment <strong>${shipmentRef}</strong> is ready: <strong>${price} ${currency}</strong>. Please log in to approve or reject.</p>`,
  };
}
