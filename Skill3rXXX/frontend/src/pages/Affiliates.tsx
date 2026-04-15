/**
 * Affiliates page — shows affiliate profile, referral code, stats, and payout requests.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

export default function AffiliatesPage() {
  const qc = useQueryClient();
  const [payoutMethod, setPayoutMethod] = useState<"paypal" | "stripe">("paypal");

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

  const applyMutation = useMutation({
    mutationFn: () => affiliatesApi.apply(),
    onSuccess: () => {
      toast.success("Application submitted! Pending admin approval.");
      qc.invalidateQueries({ queryKey: ["affiliate"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "Application failed"),
  });

  const payoutMutation = useMutation({
    mutationFn: (method: string) => affiliatesApi.requestPayout(method),
    onSuccess: () => {
      toast.success("Payout request submitted!");
      qc.invalidateQueries({ queryKey: ["affiliate"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "Payout request failed"),
  });

  // User hasn't applied yet
  if (!loadingProfile && profileError) {
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
              Earn up to 20% commission on every sale you refer. Get a unique link,
              track your clicks and conversions in real time.
            </p>
            <ul className="text-sm text-gray-400 text-left space-y-2 mb-6">
              <li>✅ 20% commission on all product sales</li>
              <li>✅ 30-day cookie window</li>
              <li>✅ Real-time click & conversion tracking</li>
              <li>✅ PayPal or Stripe payouts</li>
              <li>✅ Minimum $50 payout threshold</li>
            </ul>
            <button
              className="btn-primary w-full"
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? "Applying..." : "Apply to Become an Affiliate"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingProfile || loadingStats) return <LoadingSpinner size="lg" />;

  const s = stats!;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Your Affiliate Dashboard</h2>
          <p className="text-gray-400 mt-1">
            Referral code:{" "}
            <code className="bg-gray-800 px-2 py-0.5 rounded text-brand-400 font-mono">
              {s.code}
            </code>
          </p>
        </div>
        {!profile?.isApproved && (
          <span className="badge-yellow">Pending Approval</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clicks" value={s.totalClicks.toLocaleString()} icon="👆" color="blue" />
        <StatCard label="Conversions" value={s.totalConversions.toLocaleString()} icon="✅" color="green" />
        <StatCard label="Conv. Rate" value={`${s.conversionRate}%`} icon="📊" color="purple" />
        <StatCard label="Total Earned" value={formatCents(s.totalEarningsCents)} icon="💰" color="green" />
      </div>

      {/* Payout card */}
      <div className="card">
        <h3 className="font-semibold text-white mb-4">Request Payout</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">
              {formatCents(s.pendingPayoutCents)}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-brand-400">
              {formatCents(s.totalPaidCents)}
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Payout method</label>
            <select
              className="input"
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value as "paypal" | "stripe")}
            >
              <option value="paypal">PayPal</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>
          <button
            className="btn-primary"
            onClick={() => payoutMutation.mutate(payoutMethod)}
            disabled={payoutMutation.isPending || s.pendingPayoutCents < 5000 || !profile?.isApproved}
          >
            {payoutMutation.isPending ? "Requesting..." : "Request Payout"}
          </button>
        </div>
        {s.pendingPayoutCents < 5000 && (
          <p className="text-xs text-gray-500 mt-2">
            Minimum payout is $50.00. You need {formatCents(5000 - s.pendingPayoutCents)} more.
          </p>
        )}
      </div>

      {/* Share link */}
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
              toast.success("Link copied to clipboard!");
            }}
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Commission rate: {(s.commissionRate * 100).toFixed(0)}% on all referred sales
        </p>
      </div>
    </div>
  );
}
