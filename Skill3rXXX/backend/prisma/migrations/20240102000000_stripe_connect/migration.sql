-- Add ConnectStatus enum and Stripe Connect fields to AffiliateProfile

CREATE TYPE "ConnectStatus" AS ENUM (
  'NOT_STARTED',
  'ONBOARDING',
  'ACTIVE',
  'RESTRICTED'
);

ALTER TABLE "AffiliateProfile"
  ADD COLUMN "stripeConnectStatus" "ConnectStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- stripeAccountId must be unique (one Connect account per affiliate)
ALTER TABLE "AffiliateProfile"
  ADD CONSTRAINT "AffiliateProfile_stripeAccountId_key" UNIQUE ("stripeAccountId");
