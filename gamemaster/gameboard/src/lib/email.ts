import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? "noreply@thegameboard.app";

const resend = apiKey ? new Resend(apiKey) : null;

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", to);
    return;
  }
  try {
    await resend.emails.send({ from, to, subject, html });
  } catch (err) {
    console.error("[email] Failed to send to", to, err);
  }
}

export async function sendQuestJoinEmail(
  creatorEmail: string,
  creatorName: string,
  questTitle: string,
  payerName: string,
  amount: number
) {
  const dollars = (amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  await sendEmail(
    creatorEmail,
    `Someone joined your quest: ${questTitle}`,
    `<p>Hi ${creatorName},</p>
<p><strong>${payerName}</strong> just joined your quest <strong>${questTitle}</strong> and paid ${dollars} into escrow.</p>
<p>Log in to The Gameboard to view the quest and track progress.</p>`
  );
}

export async function sendEscrowReleasedEmail(
  creatorEmail: string,
  creatorName: string,
  questTitle: string,
  netAmount: number
) {
  const dollars = (netAmount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  await sendEmail(
    creatorEmail,
    `Funds released for: ${questTitle}`,
    `<p>Hi ${creatorName},</p>
<p>The Game Master has released escrow for your quest <strong>${questTitle}</strong>.</p>
<p>Your payout: <strong>${dollars}</strong></p>
<p>Log in to request a withdrawal from your profile.</p>`
  );
}

export async function sendDisputeFiledEmail(
  creatorEmail: string,
  creatorName: string,
  questTitle: string
) {
  await sendEmail(
    creatorEmail,
    `Dispute filed on your quest: ${questTitle}`,
    `<p>Hi ${creatorName},</p>
<p>A participant has filed a dispute on your quest <strong>${questTitle}</strong>.</p>
<p>The Game Master will review the dispute. You may be contacted for additional information.</p>`
  );
}

export async function sendWithdrawalRequestEmail(
  adminEmail: string,
  userName: string,
  amount: number
) {
  const dollars = (amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  await sendEmail(
    adminEmail,
    `Withdrawal request from ${userName}`,
    `<p>${userName} has requested a withdrawal of <strong>${dollars}</strong>.</p>
<p>Log in to the Game Master dashboard to approve or reject.</p>`
  );
}
