import { prisma } from "../db/client";
import { sendEmail } from "./mailer";
import { sequence1, sequence2, sequence3 } from "./templates";
import { config } from "../config";
import { logger } from "../utils/logger";

const SEQUENCE_DELAYS_DAYS = [0, 3, 7]; // day 0=initial, 3=followup, 7=final

export async function processOutreachQueue(): Promise<void> {
  const now = new Date();

  // Find prospects who need outreach (FOUND with no messages yet)
  const newProspects = await prisma.prospect.findMany({
    where: { status: "FOUND" },
    include: { outreach: true },
  });

  let sent = 0;

  for (const prospect of newProspects) {
    if (prospect.outreach.length === 0) {
      await sendSequenceEmail(prospect.id, prospect.email, prospect.name ?? "there", 1);
      await prisma.prospect.update({ where: { id: prospect.id }, data: { status: "CONTACTED" } });
      sent++;
    }
  }

  // Find contacted prospects needing follow-ups
  const contacted = await prisma.prospect.findMany({
    where: { status: "CONTACTED" },
    include: { outreach: { orderBy: { sentAt: "asc" } } },
  });

  for (const prospect of contacted) {
    const lastMsg = prospect.outreach[prospect.outreach.length - 1];
    if (!lastMsg) continue;

    const nextSeq = lastMsg.sequence + 1;
    if (nextSeq > 3) continue; // done with sequence

    const daysSinceLast = Math.floor(
      (now.getTime() - new Date(lastMsg.sentAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const requiredDelay = SEQUENCE_DELAYS_DAYS[nextSeq - 1] ?? 999;

    if (daysSinceLast >= requiredDelay) {
      await sendSequenceEmail(prospect.id, prospect.email, prospect.name ?? "there", nextSeq);
      sent++;
    }
  }

  logger.info(`[outreach] processed queue — sent ${sent} emails`);
}

async function sendSequenceEmail(
  prospectId: string,
  email: string,
  name: string,
  sequence: number
): Promise<void> {
  const ctx = {
    affiliateName: name,
    fromName: config.smtp.fromName,
    storeUrl: config.storeUrl,
    commissionRate: 0.3,
    signupUrl: `${config.baseUrl}/apply`,
    unsubscribeUrl: `${config.baseUrl}/unsubscribe?id=${prospectId}`,
  };

  const templateFns = [sequence1, sequence2, sequence3];
  const template = templateFns[sequence - 1]?.(ctx);
  if (!template) return;

  const sent = await sendEmail({ to: email, ...template });

  if (sent) {
    await prisma.outreachMessage.create({
      data: {
        prospectId,
        sequence,
        subject: template.subject,
        body: template.text,
      },
    });
  }
}
