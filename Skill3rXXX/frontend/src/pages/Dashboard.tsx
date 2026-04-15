/**
 * Dashboard page — primary revenue overview.
 * Shows: today's revenue, MRR, affiliate commissions, top products,
 * and a 30-day revenue chart.
 */
import { useRevenueSummary, useTopProducts, formatCents } from "../hooks/useRevenue";
import StatCard from "../components/ui/StatCard";
import RevenueChart from "../components/ui/RevenueChart";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { useAuthStore } from "../store";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: revenue, isLoading: loadingRev } = useRevenueSummary();
  const { data: topProducts, isLoading: loadingProds } = useTopProducts();

  if (loadingRev) return <LoadingSpinner size="lg" />;

  const r = revenue!;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          Welcome back, {user?.firstName} 👋
        </h2>
        <p className="text-gray-400 mt-1">
          Here's your passive income overview for today.
        </p>
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Revenue"
          value={formatCents(r.today.revenueInCents)}
          subValue={`${r.today.orders} orders`}
          icon="💵"
          color="green"
        />
        <StatCard
          label="Monthly Recurring"
          value={formatCents(r.subscriptions.mrrInCents)}
          subValue={`${r.subscriptions.active} active subscribers`}
          icon="🔄"
          color="blue"
        />
        <StatCard
          label="Affiliate (30d)"
          value={formatCents(r.affiliates.last30DaysCommission)}
          subValue={`${r.affiliates.last30DaysConversions} conversions`}
          icon="🔗"
          color="purple"
        />
        <StatCard
          label="30-Day Revenue"
          value={formatCents(r.last30Days.revenueInCents)}
          subValue={`${r.last30Days.orders} orders`}
          icon="📈"
          color="orange"
        />
      </div>

      {/* Revenue chart */}
      {r.dailySeries && (
        <RevenueChart
          data={r.dailySeries}
          title="Daily Revenue — Last 30 Days"
        />
      )}

      {/* Two columns: top products + subscription stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
            Top Products
          </h3>
          {loadingProds ? (
            <LoadingSpinner size="sm" />
          ) : topProducts?.length === 0 ? (
            <p className="text-gray-500 text-sm">No sales yet — go activate your products!</p>
          ) : (
            <div className="space-y-3">
              {topProducts?.map((item: { product: { id: string; name: string }; revenueInCents: number; unitsSold: number }) => (
                <div key={item.product.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{item.product.name}</p>
                    <p className="text-xs text-gray-400">{item.unitsSold} sold</p>
                  </div>
                  <span className="text-brand-400 font-semibold text-sm">
                    {formatCents(item.revenueInCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subscription breakdown */}
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
            Subscription Health
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400 text-sm">Active subscribers</span>
              <span className="text-white font-semibold">{r.subscriptions.active}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400 text-sm">In trial</span>
              <span className="text-yellow-400 font-semibold">{r.subscriptions.trialing}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400 text-sm">MRR</span>
              <span className="text-brand-400 font-semibold">{formatCents(r.subscriptions.mrrInCents)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400 text-sm">ARR (projected)</span>
              <span className="text-blue-400 font-semibold">{formatCents(r.subscriptions.arrInCents)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* All-time callout */}
      <div className="card bg-gradient-to-r from-brand-500/10 to-blue-500/10 border-brand-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-300">All-Time Revenue</p>
            <p className="text-4xl font-bold text-white mt-1">
              {formatCents(r.allTime.revenueInCents)}
            </p>
            <p className="text-sm text-gray-400 mt-1">{r.allTime.orders} total orders</p>
          </div>
          <div className="text-6xl">🏆</div>
        </div>
      </div>
    </div>
  );
}
