/**
 * Stripe Connect Service
 * ─────────────────────
 * Handles the full lifecycle of a Stripe Express connected account:
 *
 *  1. createConnectAccount()   — create a Stripe Express account for the affiliate
 *  2. getOnboardingLink()      — generate a one-time onboarding URL (expires in 60s)
 *  3. refreshOnboardingLink()  — re-generate when the previous link expired
 *  4. getConnectDashboardLink()— deep link to the affiliate's Express dashboard
 *  5. syncAccountStatus()      — called by the account.updated webhook; updates DB
 *  6. executeTransfer()        — transfer commission balance to connected account
 *
 * Money flow:
 *  Customer → Stripe (platform account) → Transfer → Affiliate's connected account → Bank
 *
 * Prerequisites in Stripe Dashboard:
 *  - Enable "Connect" on your account
 *  - Set Connect settings → Express as account type
 *  - Add the return_url and refresh_url in Connect settings
 */

import Stripe from "stripe";
import { PrismaClient, ConnectStatus, PayoutStatus } from "@prisma/client";
import { config } from "../../config";
import { AppError, NotFoundError, ForbiddenError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";

const prisma = new PrismaClient();
const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2024-04-10" });

// ── 1. Create Express account ─────────────────────────────────

/**
 * Creates a Stripe Express connected account for the affiliate and saves
 * the account ID to the DB. Safe to call only once — throws if account already exists.
 */
export async function createConnectAccount(userId: string): Promise<{ accountId: string; onboardingUrl: string }> {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });
  if (!profile) throw new NotFoundError("Affiliate profile");
  if (!profile.isApproved) throw new ForbiddenError("Affiliate account must be approved first");
  if (profile.stripeAccountId) {
    // Account already exists — just return a fresh onboarding link
    const link = await buildOnboardingLink(profile.stripeAccountId);
    return { accountId: profile.stripeAccountId, onboardingUrl: link.url };
  }

  // Create the Express account — Stripe handles KYC/identity verification
  const account = await stripe.accounts.create({
    type: "express",
    email: profile.user.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: "individual",
    individual: {
      first_name: profile.user.firstName,
      last_name:  profile.user.lastName,
      email:      profile.user.email,
    },
    settings: {
      payouts: {
        schedule: { interval: "weekly", weekly_anchor: "friday" },
      },
    },
    metadata: { pimsUserId: userId, pimsAffiliateId: profile.id },
  });

  // Persist account ID immediately — before building the link
  await prisma.affiliateProfile.update({
    where: { userId },
    data: {
      stripeAccountId:     account.id,
      stripeConnectStatus: ConnectStatus.ONBOARDING,
    },
  });

  const link = await buildOnboardingLink(account.id);
  logger.info("Stripe Connect account created", { accountId: account.id, userId });

  return { accountId: account.id, onboardingUrl: link.url };
}

// ── 2. Onboarding link ────────────────────────────────────────

/**
 * Generates a fresh onboarding link for an affiliate who hasn't finished setup.
 * Links expire after 60 seconds — always generate on demand, never cache.
 */
export async function getOnboardingLink(userId: string): Promise<string> {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (!profile?.stripeAccountId) {
    throw new AppError("Stripe Connect account not created yet. Call /connect/start first.", 400);
  }
  const link = await buildOnboardingLink(profile.stripeAccountId);
  return link.url;
}

async function buildOnboardingLink(accountId: string): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account:     accountId,
    type:        "account_onboarding",
    return_url:  config.stripe.connectReturnUrl  || `${config.frontendUrl}/affiliates?connect=success`,
    refresh_url: config.stripe.connectRefreshUrl || `${config.frontendUrl}/affiliates?connect=refresh`,
  });
}

// ── 3. Express Dashboard link ─────────────────────────────────

/**
 * Returns a login link to the affiliate's Express dashboard (Stripe-hosted).
 * Only works once the account has completed onboarding (payoutsEnabled = true).
 */
export async function getExpressDashboardLink(userId: string): Promise<string> {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (!profile?.stripeAccountId) throw new AppError("No connected account found", 400);
  if (!profile.payoutsEnabled) {
    throw new AppError("Complete Stripe onboarding before accessing the dashboard", 400);
  }

  const loginLink = await stripe.accounts.createLoginLink(profile.stripeAccountId);
  return loginLink.url;
}

// ── 4. Sync account status from webhook ───────────────────────

/**
 * Called by the Stripe webhook handler when account.updated fires.
 * Updates connect status and payoutsEnabled flag in the DB.
 */
export async function syncAccountStatus(stripeAccount: Stripe.Account): Promise<void> {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { stripeAccountId: stripeAccount.id },
  });
  if (!profile) return; // Not one of our affiliates

  const payoutsEnabled  = stripeAccount.payouts_enabled  ?? false;
  const chargesEnabled  = stripeAccount.charges_enabled  ?? false;
  const detailsSubmitted = stripeAccount.details_submitted ?? false;

  let connectStatus: ConnectStatus;
  if (payoutsEnabled && chargesEnabled) {
    connectStatus = ConnectStatus.ACTIVE;
  } else if (detailsSubmitted) {
    connectStatus = ConnectStatus.RESTRICTED; // submitted but not yet fully approved
  } else {
    connectStatus = ConnectStatus.ONBOARDING;
  }

  await prisma.affiliateProfile.update({
    where: { stripeAccountId: stripeAccount.id },
    data: { stripeConnectStatus: connectStatus, payoutsEnabled },
  });

  logger.info("Stripe Connect account status synced", {
    accountId: stripeAccount.id,
    connectStatus,
    payoutsEnabled,
  });
}

// ── 5. Execute real Stripe transfer ───────────────────────────

/**
 * Transfers the commission amount from the platform Stripe balance to the
 * affiliate's connected account. This is the real money movement.
 *
 * Called automatically when an affiliate requests a payout AND has an
 * active Stripe Connect account. For PayPal, the admin still processes manually.
 *
 * Stripe Transfer semantics:
 * - The platform must have sufficient balance (funds settle after ~2 business days)
 * - `destination` is the connected account ID (acct_xxx)
 * - The transfer appears in the affiliate's Stripe Express dashboard
 * - Stripe then pays out to the affiliate's bank on their payout schedule
 */
export async function executeTransfer(payoutId: string): Promise<Stripe.Transfer> {
  const payout = await prisma.affiliatePayout.findUnique({
    where: { id: payoutId },
    include: { profile: true },
  });
  if (!payout) throw new NotFoundError("Payout record");
  if (payout.status !== PayoutStatus.PENDING) {
    throw new AppError(`Payout is already ${payout.status}`, 400);
  }
  if (!payout.profile.stripeAccountId) {
    throw new AppError("Affiliate has no connected Stripe account", 400);
  }
  if (!payout.profile.payoutsEnabled) {
    throw new AppError("Affiliate's Stripe Connect account is not fully verified", 400);
  }

  // Mark as PROCESSING before calling Stripe (idempotency safety)
  await prisma.affiliatePayout.update({
    where: { id: payoutId },
    data: { status: PayoutStatus.PROCESSING },
  });

  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create({
      amount:      payout.amountInCents,
      currency:    "usd",
      destination: payout.profile.stripeAccountId,
      description: `PIMS affiliate commission — payout ${payoutId}`,
      metadata: {
        pimsPayoutId:    payoutId,
        pimsAffiliateId: payout.profileId,
      },
    });
  } catch (err) {
    // Roll back to PENDING so admin can retry
    await prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PENDING },
    });
    logger.error("Stripe Transfer failed", { payoutId, err });
    throw new AppError(`Stripe transfer failed: ${(err as Error).message}`, 502);
  }

  // Mark PAID and record the transfer ID as the reference
  await prisma.$transaction([
    prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: {
        status:      PayoutStatus.PAID,
        reference:   transfer.id,
        processedAt: new Date(),
      },
    }),
    prisma.affiliateProfile.update({
      where: { id: payout.profileId },
      data: { totalPaid: { increment: payout.amountInCents } },
    }),
  ]);

  logger.info("Stripe transfer executed", {
    transferId: transfer.id,
    amount:     payout.amountInCents,
    destination: payout.profile.stripeAccountId,
  });

  return transfer;
}

// ── 6. Disconnect (deauthorize) ───────────────────────────────

/**
 * Deauthorizes the affiliate's connected account from the platform.
 * The affiliate can reconnect by going through onboarding again.
 */
export async function disconnectAccount(userId: string): Promise<void> {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (!profile?.stripeAccountId) throw new AppError("No connected account found", 400);

  try {
    await stripe.oauth.deauthorize({
      client_id: config.stripe.connectClientId,
      stripe_user_id: profile.stripeAccountId,
    });
  } catch (err) {
    // If already deauthorized on Stripe's side, still clean up locally
    logger.warn("Stripe deauthorize call failed (continuing cleanup)", { err });
  }

  await prisma.affiliateProfile.update({
    where: { userId },
    data: {
      stripeAccountId:     null,
      stripeConnectStatus: ConnectStatus.NOT_STARTED,
      payoutsEnabled:      false,
    },
  });
}

// ── 7. Status summary (for frontend) ─────────────────────────

export async function getConnectStatus(userId: string) {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Affiliate profile");

  // If account exists in Stripe, fetch fresh status
  if (profile.stripeAccountId) {
    try {
      const account = await stripe.accounts.retrieve(profile.stripeAccountId);
      await syncAccountStatus(account); // keep DB in sync on every fetch

      return {
        status:          profile.stripeConnectStatus,
        payoutsEnabled:  account.payouts_enabled,
        chargesEnabled:  account.charges_enabled,
        detailsSubmitted: account.details_submitted,
        accountId:       profile.stripeAccountId,
        // Stripe requirements still outstanding
        requirements:    account.requirements?.currently_due ?? [],
      };
    } catch {
      // Account may have been deleted on Stripe's side
    }
  }

  return {
    status:          ConnectStatus.NOT_STARTED,
    payoutsEnabled:  false,
    chargesEnabled:  false,
    detailsSubmitted: false,
    accountId:       null,
    requirements:    [],
  };
}
