/**
 * Analytics page — deeper revenue breakdowns for admin users.
 */
import { useRevenueSummary, useRevenueSnapshots, formatCents } from "../hooks/useRevenue";
import RevenueChart from "../components/ui/RevenueChart";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { useAuthStore } from "../store";
import { Navigate } from "react-router-dom";

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== "ADMIN") return <Navigate to="/dashboard" replace />;

  const { data: revenue, isLoading: loadingRev } = useRevenueSummary();
  const { data: snapshots, isLoading: loadingSnaps } = useRevenueSnapshots(90);

  if (loadingRev || loadingSnaps) return <LoadingSpinner size="lg" />;

  const r = revenue!;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-2xl font-bold text-white">Analytics</h2>
        <p className="text-gray-400 mt-1">Deep-dive revenue and performance data</p>
      </div>

      {/* Period comparison table */}
      <div className="card overflow-x-auto">
        <h3 className="font-semibold text-white mb-4">Revenue by Period</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 py-2 font-medium">Period</th>
              <th className="text-right text-gray-400 py-2 font-medium">Revenue</th>
              <th className="text-right text-gray-400 py-2 font-medium">Orders</th>
              <th className="text-right text-gray-400 py-2 font-medium">Avg Order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[
              { label: "Today",     ...r.today },
              { label: "Last 7 days", ...r.last7Days },
              { label: "Last 30 days", ...r.last30Days },
              { label: "All time",  ...r.allTime },
            ].map((row) => (
              <tr key={row.label} className="hover:bg-gray-800/50 transition-colors">
                <td className="py-3 text-white font-medium">{row.label}</td>
                <td className="py-3 text-right text-brand-400 font-semibold">
                  {formatCents(row.revenueInCents)}
                </td>
                <td className="py-3 text-right text-gray-300">{row.orders}</td>
                <td className="py-3 text-right text-gray-400">
                  {row.orders > 0 ? formatCents(Math.round(row.revenueInCents / row.orders)) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 90-day chart */}
      {snapshots && snapshots.length > 0 && (
        <RevenueChart
          data={snapshots.map((s: { date: string; totalRevenueCents: number }) => ({
            date: s.date,
            revenueInCents: s.totalRevenueCents,
          }))}
          title="Daily Revenue — Last 90 Days"
        />
      )}

      {/* Subscription metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-white mb-4">Recurring Revenue</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">MRR</span>
              <span className="text-brand-400 font-bold">{formatCents(r.subscriptions.mrrInCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ARR (projected)</span>
              <span className="text-blue-400 font-bold">{formatCents(r.subscriptions.arrInCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active subscribers</span>
              <span className="text-white font-semibold">{r.subscriptions.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Trialing</span>
              <span className="text-yellow-400 font-semibold">{r.subscriptions.trialing}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-white mb-4">Affiliate (30 days)</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Commissions paid</span>
              <span className="text-purple-400 font-bold">
                {formatCents(r.affiliates.last30DaysCommission)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Conversions</span>
              <span className="text-white font-semibold">{r.affiliates.last30DaysConversions}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
