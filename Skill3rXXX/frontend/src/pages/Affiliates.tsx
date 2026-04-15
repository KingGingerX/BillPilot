/**
 * Affiliates page — referral tracking, earnings, and Stripe Connect onboarding.
 *
 * Connect flow:
 *  NOT_STARTED → click "Connect with Stripe" → redirected to Stripe onboarding
 *  ONBOARDING  → returned from Stripe, may need more info (requirements list shown)
 *  ACTIVE      → payouts enabled; "Stripe" payout method available instantly
 *  RESTRICTED  → account has issues; link to Stripe dashboard shown
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { affiliatesApi } from "../api/client";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import StatCard from "../components/ui/StatCard";
import { formatCents } from "../hooks/useRevenue";

interface AffiliateStats {
  code: string;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalEarningsCents: number;
  pendingPayoutCents: number;
  totalPaidCents: number;
  commissionRate: number;
}

interface ConnectStatus {
  status: "NOT_STARTED" | "ONBOARDING" | "ACTIVE" | "RESTRICTED";
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  accountId: string | null;
  requirements: string[];
}

interface Payout {
  id: string;
  amountInCents: number;
  method: string;
  status: string;
  reference: string | null;
  createdAt: string;
  processedAt: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  PAID:       "badge-green",
  PROCESSING: "badge-blue",
  PENDING:    "badge-yellow",
  FAILED:     "badge-red",
};

const CONNECT_STATUS_CONFIG = {
  NOT_STARTED: { label: "Not connected",     color: "text-gray-400",  icon: "🔌" },
  ONBOARDING:  { label: "Setup in progress", color: "text-yellow-400", icon: "⏳" },
  ACTIVE:      { label: "Active",            color: "text-green-400",  icon: "✅" },
  RESTRICTED:  { label: "Restricted",        color: "text-red-400",   icon: "⚠️" },
};

export default function AffiliatesPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [payoutMethod, setPayoutMethod] = useState<"paypal" | "stripe">("stripe");

  // Show toast when returning from Stripe onboarding
  useEffect(() => {
    const connect = searchParams.get("connect");
    if (connect === "success") {
      toast.success("Stripe account connected! Verifying status…");
      qc.invalidateQueries({ queryKey: ["affiliate", "connect"] });
    } else if (connect === "refresh") {
      toast("Onboarding session expired — click the button to get a new link.", { icon: "⚠️" });
    }
  }, [searchParams, qc]);

  // ── Data fetching ────────────────────────────────────────────

  const { data: profile, isLoading: loadingProfile, error: profileError } = useQuery({
    queryKey: ["affiliate", "me"],
    queryFn: () => affiliatesApi.me().then((r) => r.data.data),
    retry: false,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["affiliate", "stats"],
    queryFn: () => affiliatesApi.stats().then((r) => r.data.data as AffiliateStats),
    enabled: !!profile,
  });

  const { data: connectStatus, isLoading: loadingConnect } = useQuery({
    queryKey: ["affiliate", "connect"],
    queryFn: () => affiliatesApi.connect.status().then((r) => r.data.data as ConnectStatus),
    enabled: !!profile,
    refetchInterval: (query) =>
      // Poll while onboarding to detect when the account becomes ACTIVE
      query.state.data?.status === "ONBOARDING" ? 15_000 : false,
  });

  const { data: payouts, isLoading: loadingPayouts } = useQuery({
    queryKey: ["affiliate", "payouts"],
    queryFn: () => affiliatesApi.payouts().then((r) => r.data.data as Payout[]),
    enabled: !!profile,
  });

  // ── Mutations ─────────────────────────────────────────────────

  const applyMutation = useMutation({
    mutationFn: () => affiliatesApi.apply(),
    onSuccess: () => {
      toast.success("Application submitted! Pending admin approval.");
      qc.invalidateQueries({ queryKey: ["affiliate"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "Application failed"),
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      connectStatus?.status === "ONBOARDING"
        ? affiliatesApi.connect.link().then((r) => r.data.data.onboardingUrl as string)
        : affiliatesApi.connect.start().then((r) => r.data.data.onboardingUrl as string),
    onSuccess: (url) => {
      // Redirect to Stripe's hosted onboarding — opens in same tab
      window.location.href = url;
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "Could not start Stripe Connect"),
  });

  const dashboardMutation = useMutation({
    mutationFn: () => affiliatesApi.connect.dashboard().then((r) => r.data.data.url as string),
    onSuccess: (url) => window.open(url, "_blank"),
    onError: () => toast.error("Could not open Stripe dashboard"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => affiliatesApi.connect.disconnect(),
    onSuccess: () => {
      toast.success("Stripe account disconnected");
      qc.invalidateQueries({ queryKey: ["affiliate", "connect"] });
    },
  });

  const payoutMutation = useMutation({
    mutationFn: (method: string) => affiliatesApi.requestPayout(method),
    onSuccess: (res) => {
      const status = res.data.data.status;
      if (status === "PAID") {
        toast.success("Transfer sent! Funds will appear in your Stripe account.");
      } else {
        toast.success("Payout request submitted. Admin will process it shortly.");
      }
      qc.invalidateQueries({ queryKey: ["affiliate"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "Payout request failed"),
  });

  // ── Loading / not-applied states ──────────────────────────────

  if (loadingProfile && !profileError) return <LoadingSpinner size="lg" />;

  if (profileError) {
    return (
      <div className="space-y-6 animate-slide-up">
        <div>
          <h2 className="text-2xl font-bold text-white">Affiliate Program</h2>
          <p className="text-gray-400 mt-1">Earn commissions by referring new customers</p>
        </div>
        <div className="card max-w-lg">
          <div className="text-center py-6">
            <p className="text-5xl mb-4">🔗</p>
            <h3 className="text-xl font-bold text-white mb-2">Join the Affiliate Program</h3>
            <p className="text-gray-400 mb-6">
              Earn 20% on every sale you refer. Connect your Stripe account for instant automatic payouts.
            </p>
            <ul className="text-sm text-gray-400 text-left space-y-2 mb-6">
              <li>✅ 20% commission on all product sales</li>
              <li>✅ Real-time click & conversion tracking</li>
              <li>✅ Instant payouts via Stripe Connect</li>
              <li>✅ Weekly automatic bank transfers</li>
              <li>✅ $50 minimum payout threshold</li>
            </ul>
            <button
              className="btn-primary w-full"
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? "Applying…" : "Apply to Become an Affiliate"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingStats || loadingConnect) return <LoadingSpinner size="lg" />;

  const s = stats!;
  const cs = connectStatus;
  const csConfig = CONNECT_STATUS_CONFIG[cs?.status ?? "NOT_STARTED"];
  const canPayStripe = cs?.payoutsEnabled && payoutMethod === "stripe";

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Your Affiliate Dashboard</h2>
          <p className="text-gray-400 mt-1">
            Referral code:{" "}
            <code className="bg-gray-800 px-2 py-0.5 rounded text-brand-400 font-mono">{s.code}</code>
          </p>
        </div>
        {!profile?.isApproved && <span className="badge-yellow">Pending Approval</span>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clicks"       value={s.totalClicks.toLocaleString()} icon="👆" color="blue" />
        <StatCard label="Conversions"        value={s.totalConversions.toLocaleString()} icon="✅" color="green" />
        <StatCard label="Conversion Rate"    value={`${s.conversionRate}%`} icon="📊" color="purple" />
        <StatCard label="Total Earned"       value={formatCents(s.totalEarningsCents)} icon="💰" color="green" />
      </div>

      {/* ── Stripe Connect Card ─────────────────────────────────── */}
      <div className={`card ${cs?.status === "ACTIVE" ? "border-green-700/50" : cs?.status === "RESTRICTED" ? "border-red-700/50" : "border-gray-700"}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Stripe Connect</h3>
          <span className={`text-sm font-medium ${csConfig.color} flex items-center gap-1.5`}>
            {csConfig.icon} {csConfig.label}
          </span>
        </div>

        {cs?.status === "NOT_STARTED" && (
          <div>
            <p className="text-sm text-gray-400 mb-4">
              Connect your Stripe account to receive <strong className="text-white">instant automatic payouts</strong> directly
              to your bank — no waiting for admin approval.
            </p>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || !profile?.isApproved}
            >
              {connectMutation.isPending ? (
                "Redirecting to Stripe…"
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 32 32" fill="currentColor">
                    <path d="M13.28 7.79c0-1.17.96-1.62 2.55-1.62 2.28 0 5.16.69 7.44 1.92V2.46C20.9 1.38 18.06.8 15.28.8 9.96.8 6.34 3.68 6.34 8.08c0 6.72 9.24 5.64 9.24 8.52 0 1.38-1.2 1.83-2.88 1.83-2.49 0-5.67-.99-8.19-2.34v5.7c2.79 1.2 5.61 1.71 8.19 1.71 5.46 0 9.21-2.7 9.21-7.17-.03-7.26-9.33-5.97-8.63-8.34z"/>
                  </svg>
                  Connect with Stripe
                </>
              )}
            </button>
            {!profile?.isApproved && (
              <p className="text-xs text-gray-500 mt-2">Your affiliate account must be approved first.</p>
            )}
          </div>
        )}

        {cs?.status === "ONBOARDING" && (
          <div>
            <p className="text-sm text-gray-400 mb-4">
              You've started the Stripe setup but haven't finished yet. Complete it to enable payouts.
            </p>
            {cs.requirements.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-yellow-400 mb-2">Still needed:</p>
                <ul className="text-xs text-yellow-300 space-y-1">
                  {cs.requirements.map((r) => <li key={r}>· {r.replace(/_/g, " ")}</li>)}
                </ul>
              </div>
            )}
            <button
              className="btn-primary"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? "Redirecting…" : "Continue Stripe Onboarding →"}
            </button>
          </div>
        )}

        {cs?.status === "ACTIVE" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Your Stripe account is fully verified. Payouts go directly to your bank on Stripe's weekly schedule.
            </p>
            <div className="flex gap-3">
              <button
                className="btn-secondary text-sm"
                onClick={() => dashboardMutation.mutate()}
                disabled={dashboardMutation.isPending}
              >
                {dashboardMutation.isPending ? "Opening…" : "Open Stripe Dashboard ↗"}
              </button>
              <button
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
                onClick={() => {
                  if (confirm("Disconnect your Stripe account? You can reconnect anytime.")) {
                    disconnectMutation.mutate();
                  }
                }}
                disabled={disconnectMutation.isPending}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {cs?.status === "RESTRICTED" && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              Your Stripe account has restrictions. Open your Stripe dashboard to resolve them.
            </p>
            {cs.requirements.length > 0 && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-red-400 mb-2">Action required:</p>
                <ul className="text-xs text-red-300 space-y-1">
                  {cs.requirements.map((r) => <li key={r}>· {r.replace(/_/g, " ")}</li>)}
                </ul>
              </div>
            )}
            <button
              className="btn-primary text-sm"
              onClick={() => dashboardMutation.mutate()}
              disabled={dashboardMutation.isPending}
            >
              Resolve in Stripe ↗
            </button>
          </div>
        )}
      </div>

      {/* ── Payout Request ──────────────────────────────────────── */}
      <div className="card">
        <h3 className="font-semibold text-white mb-4">Request Payout</h3>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Available Balance</p>
            <p className="text-2xl font-bold text-yellow-400">{formatCents(s.pendingPayoutCents)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Paid Out</p>
            <p className="text-2xl font-bold text-brand-400">{formatCents(s.totalPaidCents)}</p>
          </div>
        </div>

        {/* Method selector */}
        <div className="flex gap-3 mb-4">
          <button
            className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              payoutMethod === "stripe"
                ? "bg-brand-500/10 border-brand-500 text-brand-400"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
            }`}
            onClick={() => setPayoutMethod("stripe")}
          >
            Stripe Connect
            {cs?.status === "ACTIVE" && (
              <span className="ml-1.5 text-xs text-green-400">● Instant</span>
            )}
          </button>
          <button
            className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              payoutMethod === "paypal"
                ? "bg-blue-500/10 border-blue-500 text-blue-400"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
            }`}
            onClick={() => setPayoutMethod("paypal")}
          >
            PayPal
            <span className="ml-1.5 text-xs text-gray-500">Manual</span>
          </button>
        </div>

        {/* Method hints */}
        {payoutMethod === "stripe" && cs?.status !== "ACTIVE" && (
          <p className="text-xs text-yellow-400 mb-3">
            Complete Stripe Connect onboarding above to enable instant payouts.
          </p>
        )}
        {payoutMethod === "paypal" && !profile?.paypalEmail && (
          <p className="text-xs text-yellow-400 mb-3">
            Add your PayPal email in account settings before requesting a PayPal payout.
          </p>
        )}
        {payoutMethod === "stripe" && cs?.status === "ACTIVE" && (
          <p className="text-xs text-green-400 mb-3">
            Funds transfer instantly to your connected account and reach your bank on Stripe's weekly schedule.
          </p>
        )}
        {payoutMethod === "paypal" && (
          <p className="text-xs text-gray-500 mb-3">
            PayPal payouts are processed manually — expect 1–3 business days.
          </p>
        )}

        <button
          className="btn-primary w-full"
          onClick={() => payoutMutation.mutate(payoutMethod)}
          disabled={
            payoutMutation.isPending ||
            s.pendingPayoutCents < 5000 ||
            !profile?.isApproved ||
            (payoutMethod === "stripe" && cs?.status !== "ACTIVE")
          }
        >
          {payoutMutation.isPending
            ? "Processing…"
            : payoutMethod === "stripe"
            ? `Transfer ${formatCents(s.pendingPayoutCents)} via Stripe`
            : `Request ${formatCents(s.pendingPayoutCents)} via PayPal`}
        </button>

        {s.pendingPayoutCents < 5000 && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Minimum payout is $50.00 — you need {formatCents(5000 - s.pendingPayoutCents)} more.
          </p>
        )}
      </div>

      {/* ── Referral link ─────────────────────────────────────────── */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3">Your Referral Link</h3>
        <div className="flex gap-3">
          <input
            className="input flex-1 font-mono text-sm"
            readOnly
            value={`${window.location.origin}/ref/${s.code}`}
          />
          <button
            className="btn-secondary"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/ref/${s.code}`);
              toast.success("Link copied!");
            }}
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Commission: {(s.commissionRate * 100).toFixed(0)}% on all referred sales
        </p>
      </div>

      {/* ── Payout history ───────────────────────────────────────── */}
      {!loadingPayouts && payouts && payouts.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-white mb-4">Payout History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 py-2 font-medium">Date</th>
                  <th className="text-left text-gray-400 py-2 font-medium">Method</th>
                  <th className="text-right text-gray-400 py-2 font-medium">Amount</th>
                  <th className="text-left text-gray-400 py-2 font-medium pl-4">Status</th>
                  <th className="text-left text-gray-400 py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 text-gray-300">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-300 capitalize">{p.method}</td>
                    <td className="py-3 text-right text-white font-semibold">
                      {formatCents(p.amountInCents)}
                    </td>
                    <td className="py-3 pl-4">
                      <span className={STATUS_BADGE[p.status] ?? "badge-gray"}>{p.status}</span>
                    </td>
                    <td className="py-3 text-gray-500 font-mono text-xs">
                      {p.reference
                        ? <a
                            href={`https://dashboard.stripe.com/transfers/${p.reference}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-400 hover:underline"
                          >
                            {p.reference.slice(0, 16)}…
                          </a>
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
