-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AFFILIATE', 'SUBSCRIBER', 'USER');
CREATE TYPE "ProductType" AS ENUM ('PDF', 'COURSE', 'TEMPLATE', 'SOFTWARE', 'BUNDLE');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING', 'INCOMPLETE');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED');
CREATE TYPE "ContentPlatform" AS ENUM ('BLOG', 'TWITTER', 'FACEBOOK', 'INSTAGRAM', 'PINTEREST', 'EMAIL', 'LINKEDIN');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateTable: User
CREATE TABLE "User" (
    "id"               TEXT NOT NULL,
    "email"            TEXT NOT NULL,
    "passwordHash"     TEXT NOT NULL,
    "firstName"        TEXT NOT NULL,
    "lastName"         TEXT NOT NULL,
    "role"             "Role" NOT NULL DEFAULT 'USER',
    "isEmailVerified"  BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "resetToken"       TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateTable: RefreshToken
CREATE TABLE "RefreshToken" (
    "id"        TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Product
CREATE TABLE "Product" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "longDescription" TEXT,
    "type"            "ProductType" NOT NULL,
    "status"          "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "priceInCents"    INTEGER NOT NULL,
    "stripePriceId"   TEXT,
    "stripeProductId" TEXT,
    "downloadUrl"     TEXT,
    "coverImageUrl"   TEXT,
    "salesCount"      INTEGER NOT NULL DEFAULT 0,
    "tags"            TEXT[],
    "metadata"        JSONB,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_slug_idx" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateTable: Order
CREATE TABLE "Order" (
    "id"                 TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "status"             "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmountInCents" INTEGER NOT NULL,
    "stripePaymentIntent" TEXT,
    "stripeSessionId"    TEXT,
    "affiliateCode"      TEXT,
    "ipAddress"          TEXT,
    "userAgent"          TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_stripeSessionId_idx" ON "Order"("stripeSessionId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE;

-- CreateTable: OrderItem
CREATE TABLE "OrderItem" (
    "id"           TEXT NOT NULL,
    "orderId"      TEXT NOT NULL,
    "productId"    TEXT NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "quantity"     INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON UPDATE CASCADE;

-- CreateTable: SubscriptionPlan
CREATE TABLE "SubscriptionPlan" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "priceInCents"    INTEGER NOT NULL,
    "intervalDays"    INTEGER NOT NULL,
    "features"        TEXT[],
    "stripePriceId"   TEXT,
    "stripeProductId" TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "SubscriptionPlan"("slug");

-- CreateTable: Subscription
CREATE TABLE "Subscription" (
    "id"                   TEXT NOT NULL,
    "userId"               TEXT NOT NULL,
    "planId"               TEXT NOT NULL,
    "status"               "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId"     TEXT,
    "currentPeriodStart"   TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd"     TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd"    BOOLEAN NOT NULL DEFAULT false,
    "canceledAt"           TIMESTAMP(3),
    "trialEnd"             TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON UPDATE CASCADE;

-- CreateTable: AffiliateProfile
CREATE TABLE "AffiliateProfile" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "code"           TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "totalEarnings"  INTEGER NOT NULL DEFAULT 0,
    "pendingPayout"  INTEGER NOT NULL DEFAULT 0,
    "totalPaid"      INTEGER NOT NULL DEFAULT 0,
    "paypalEmail"    TEXT,
    "stripeAccountId" TEXT,
    "isApproved"     BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");
CREATE UNIQUE INDEX "AffiliateProfile_code_key" ON "AffiliateProfile"("code");
CREATE INDEX "AffiliateProfile_code_idx" ON "AffiliateProfile"("code");
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE;

-- CreateTable: AffiliateClick
CREATE TABLE "AffiliateClick" (
    "id"          TEXT NOT NULL,
    "profileId"   TEXT NOT NULL,
    "ipAddress"   TEXT NOT NULL,
    "userAgent"   TEXT,
    "referrerUrl" TEXT,
    "landingPage" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AffiliateClick_profileId_idx" ON "AffiliateClick"("profileId");
CREATE INDEX "AffiliateClick_createdAt_idx" ON "AffiliateClick"("createdAt");
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile"("id") ON UPDATE CASCADE;

-- CreateTable: AffiliateConversion
CREATE TABLE "AffiliateConversion" (
    "id"                TEXT NOT NULL,
    "profileId"         TEXT NOT NULL,
    "orderId"           TEXT NOT NULL,
    "commissionInCents" INTEGER NOT NULL,
    "isPaid"            BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AffiliateConversion_orderId_key" ON "AffiliateConversion"("orderId");
CREATE INDEX "AffiliateConversion_profileId_idx" ON "AffiliateConversion"("profileId");
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile"("id") ON UPDATE CASCADE;
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON UPDATE CASCADE;

-- CreateTable: AffiliatePayout
CREATE TABLE "AffiliatePayout" (
    "id"            TEXT NOT NULL,
    "profileId"     TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "status"        "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "method"        TEXT NOT NULL,
    "reference"     TEXT,
    "processedAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AffiliatePayout_profileId_idx" ON "AffiliatePayout"("profileId");
CREATE INDEX "AffiliatePayout_status_idx" ON "AffiliatePayout"("status");
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile"("id") ON UPDATE CASCADE;

-- CreateTable: ContentPost
CREATE TABLE "ContentPost" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "body"         TEXT NOT NULL,
    "excerpt"      TEXT,
    "platform"     "ContentPlatform" NOT NULL,
    "status"       "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt"  TIMESTAMP(3),
    "publishedAt"  TIMESTAMP(3),
    "slug"         TEXT,
    "tags"         TEXT[],
    "metadata"     JSONB,
    "aiGenerated"  BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentPost_slug_key" ON "ContentPost"("slug");
CREATE INDEX "ContentPost_platform_idx" ON "ContentPost"("platform");
CREATE INDEX "ContentPost_status_idx" ON "ContentPost"("status");
CREATE INDEX "ContentPost_scheduledAt_idx" ON "ContentPost"("scheduledAt");
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE;

-- CreateTable: RevenueSnapshot
CREATE TABLE "RevenueSnapshot" (
    "id"                   TEXT NOT NULL,
    "date"                 TIMESTAMP(3) NOT NULL,
    "productRevenueCents"  INTEGER NOT NULL DEFAULT 0,
    "subscriptionRevCents" INTEGER NOT NULL DEFAULT 0,
    "affiliateRevCents"    INTEGER NOT NULL DEFAULT 0,
    "adRevenueCents"       INTEGER NOT NULL DEFAULT 0,
    "totalRevenueCents"    INTEGER NOT NULL DEFAULT 0,
    "newOrders"            INTEGER NOT NULL DEFAULT 0,
    "newSubscriptions"     INTEGER NOT NULL DEFAULT 0,
    "activeSubscriptions"  INTEGER NOT NULL DEFAULT 0,
    "affiliateClicks"      INTEGER NOT NULL DEFAULT 0,
    "affiliateConversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RevenueSnapshot_date_key" ON "RevenueSnapshot"("date");
CREATE INDEX "RevenueSnapshot_date_idx" ON "RevenueSnapshot"("date");

-- CreateTable: AdPlacement
CREATE TABLE "AdPlacement" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "network"       TEXT NOT NULL,
    "placementCode" TEXT NOT NULL,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "pageViews"     INTEGER NOT NULL DEFAULT 0,
    "clicks"        INTEGER NOT NULL DEFAULT 0,
    "estimatedRev"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdPlacement_pkey" PRIMARY KEY ("id")
);
