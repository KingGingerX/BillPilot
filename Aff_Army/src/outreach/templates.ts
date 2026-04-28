import { OutreachContext } from "../models/types";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function baseLayout(content: string, ctx: OutreachContext): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .wrap { max-width: 580px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .header { background: #0f172a; padding: 28px 40px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .body { padding: 40px; }
    .cta { display: inline-block; background: #6366f1; color: #fff !important; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .footer { border-top: 1px solid #eee; padding: 20px 40px; font-size: 12px; color: #888; }
    p { line-height: 1.7; margin: 0 0 16px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1>${ctx.fromName} Affiliate Program</h1></div>
    <div class="body">${content}</div>
    <div class="footer">
      You're receiving this because you match our affiliate criteria.
      <a href="${ctx.unsubscribeUrl}">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`.trim();
}

export function sequence1(ctx: OutreachContext): EmailTemplate {
  const subject = `Partner with us — earn ${Math.round(ctx.commissionRate * 100)}% commission`;

  const content = `
    <p>Hi ${ctx.affiliateName},</p>
    <p>I came across your work and think there's a great fit between your audience and what we offer at <a href="${ctx.storeUrl}">${ctx.storeUrl}</a>.</p>
    <p>We're looking for partners who can promote our products to their audience. Here's the deal:</p>
    <ul>
      <li><strong>${Math.round(ctx.commissionRate * 100)}% commission</strong> on every sale you drive</li>
      <li>30-day cookie window — you get credit for delayed purchases</li>
      <li>Real-time dashboard to track your earnings</li>
      <li>Monthly payouts via PayPal or bank transfer</li>
    </ul>
    <p>Our products sell well and the affiliate program practically runs itself once you share your link.</p>
    <a href="${ctx.signupUrl}" class="cta">Join the Affiliate Program</a>
    <p>Takes 2 minutes to sign up. Happy to answer any questions — just reply to this email.</p>
    <p>Best,<br>${ctx.fromName}</p>`;

  return {
    subject,
    html: baseLayout(content, ctx),
    text: `Hi ${ctx.affiliateName},\n\nWe'd love to have you as an affiliate partner. Earn ${Math.round(ctx.commissionRate * 100)}% commission on every sale.\n\nSign up: ${ctx.signupUrl}\n\n${ctx.fromName}`,
  };
}

export function sequence2(ctx: OutreachContext): EmailTemplate {
  const subject = `Quick follow-up — affiliate opportunity`;

  const content = `
    <p>Hi ${ctx.affiliateName},</p>
    <p>Just checking in on my previous email about our affiliate program.</p>
    <p>In case you missed it: we're offering <strong>${Math.round(ctx.commissionRate * 100)}% commission</strong> on all sales you refer. Based on our average order value, most active affiliates earn $200–$800/month with minimal effort.</p>
    <p>No minimum traffic requirements. No approval waitlists. Just sign up and start sharing your link.</p>
    <a href="${ctx.signupUrl}" class="cta">Get My Affiliate Link</a>
    <p>If this isn't a fit, no worries — just reply and I'll stop reaching out.</p>
    <p>Best,<br>${ctx.fromName}</p>`;

  return {
    subject,
    html: baseLayout(content, ctx),
    text: `Hi ${ctx.affiliateName},\n\nFollowing up on the affiliate opportunity. Earn ${Math.round(ctx.commissionRate * 100)}% commission.\n\nSign up: ${ctx.signupUrl}\n\n${ctx.fromName}`,
  };
}

export function sequence3(ctx: OutreachContext): EmailTemplate {
  const subject = `Last chance — affiliate partner invite`;

  const content = `
    <p>Hi ${ctx.affiliateName},</p>
    <p>I've reached out a couple of times about our affiliate program. This will be my last email on this.</p>
    <p>If the timing's ever right, our affiliate link is always open at:</p>
    <a href="${ctx.signupUrl}" class="cta">Join Any Time</a>
    <p>The ${Math.round(ctx.commissionRate * 100)}% commission and 30-day cookie will be waiting for you.</p>
    <p>Wishing you success either way.</p>
    <p>Best,<br>${ctx.fromName}</p>`;

  return {
    subject,
    html: baseLayout(content, ctx),
    text: `Hi ${ctx.affiliateName},\n\nLast follow-up. Our affiliate program is always open: ${ctx.signupUrl}\n\n${ctx.fromName}`,
  };
}

export function approvalEmail(ctx: OutreachContext & { code: string; dashboardUrl: string }): EmailTemplate {
  const subject = `You're approved! Here's your affiliate link`;

  const content = `
    <p>Hi ${ctx.affiliateName},</p>
    <p>Great news — you've been approved as an affiliate partner!</p>
    <p>Your unique affiliate code is: <strong>${(ctx as any).code}</strong></p>
    <p>Share this link to start earning:</p>
    <p><code>${ctx.storeUrl}?ref=${(ctx as any).code}</code></p>
    <a href="${(ctx as any).dashboardUrl}" class="cta">View Your Dashboard</a>
    <p>You'll earn <strong>${Math.round(ctx.commissionRate * 100)}% commission</strong> on every sale. Payouts are processed monthly.</p>
    <p>Questions? Just reply to this email.</p>
    <p>Best,<br>${ctx.fromName}</p>`;

  return {
    subject,
    html: baseLayout(content, ctx),
    text: `You're approved! Your affiliate code: ${(ctx as any).code}\n\nYour link: ${ctx.storeUrl}?ref=${(ctx as any).code}\n\nDashboard: ${(ctx as any).dashboardUrl}`,
  };
}
