import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../utils/logger";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  if (!config.smtp.user || !config.smtp.pass) {
    logger.warn(`[mailer] SMTP not configured — skipping email to ${opts.to}`);
    return false;
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    logger.info(`[mailer] sent to ${opts.to}: ${info.messageId}`);
    return true;
  } catch (err) {
    logger.error(`[mailer] failed to send to ${opts.to}:`, err);
    return false;
  }
}

export async function verifySmtp(): Promise<boolean> {
  if (!config.smtp.user || !config.smtp.pass) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}
