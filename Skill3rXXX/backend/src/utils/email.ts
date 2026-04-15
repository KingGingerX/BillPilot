/**
 * Email service using Nodemailer.
 * In production connect to SendGrid / Postmark / SES via SMTP.
 * Fails gracefully in test environment.
 */
import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "./logger";

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (config.isTest()) {
    // Use Ethereal for testing (messages are captured, not sent)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });
  return transporter;
}

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends an email. Logs a warning on failure but does not throw —
 * email delivery should never crash the application request flow.
 */
export async function sendEmail(opts: SendOptions): Promise<void> {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: config.email.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
    });
    logger.debug("Email sent", { messageId: info.messageId, to: opts.to });
  } catch (err) {
    logger.warn("Failed to send email", { to: opts.to, subject: opts.subject, err });
  }
}

// ── Templates ────────────────────────────────────────────────

export function emailVerifyTemplate(firstName: string, verifyUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2>Welcome to PIMS, ${firstName}!</h2>
      <p>Verify your email address to start earning:</p>
      <a href="${verifyUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Verify Email
      </a>
      <p>This link expires in 24 hours.</p>
    </div>`;
}

export function passwordResetTemplate(firstName: string, resetUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2>Password Reset — PIMS</h2>
      <p>Hi ${firstName}, click below to reset your password:</p>
      <a href="${resetUrl}" style="background:#ef4444;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Reset Password
      </a>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>`;
}

export function orderConfirmTemplate(
  firstName: string,
  orderTotal: string,
  downloadUrl: string
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2>Order Confirmed — PIMS</h2>
      <p>Hi ${firstName}, thank you for your purchase of <strong>${orderTotal}</strong>!</p>
      <a href="${downloadUrl}" style="background:#22c55e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Download Your Product
      </a>
      <p>Your download link expires in 48 hours.</p>
    </div>`;
}
