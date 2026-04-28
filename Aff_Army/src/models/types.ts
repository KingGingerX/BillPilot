export interface ScoutResult {
  name?: string;
  email: string;
  handle?: string;
  platform: string;
  niche?: string;
  followerCount?: number;
  website?: string;
  score: number;
}

export interface OutreachContext {
  affiliateName: string;
  fromName: string;
  storeUrl: string;
  commissionRate: number;
  signupUrl: string;
  unsubscribeUrl: string;
}

export interface ConversionPayload {
  orderId: string;
  amount: number;  // cents
  affiliateCode?: string;
  sessionId?: string;
}

export interface AnalyticsSummary {
  totalAffiliates: number;
  activeAffiliates: number;
  totalProspects: number;
  pendingOutreach: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  totalCommission: number;
  pendingPayouts: number;
  conversionRate: string;
}
