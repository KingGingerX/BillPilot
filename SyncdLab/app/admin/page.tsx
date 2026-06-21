import type { Metadata } from 'next'
import { BarChart3, Users, Megaphone, Globe, Shield, Home } from 'lucide-react'
import DashboardShell from '@/components/layout/DashboardShell'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DashboardMetricCard from '@/components/ui/DashboardMetricCard'
import GlassCard from '@/components/ui/GlassCard'
import ActivityFeedItem from '@/components/ui/ActivityFeedItem'
import { MOCK_STATS } from '@/lib/mock-data'

export const metadata: Metadata = {
  title: 'Admin HQ',
  robots: { index: false, follow: false },
}

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/admin/house-brands', label: 'House Brands', icon: <Home className="w-4 h-4" /> },
  { href: '/admin/campaigns', label: 'All Campaigns', icon: <Megaphone className="w-4 h-4" /> },
  { href: '/admin/seo', label: 'SEO Manager', icon: <Globe className="w-4 h-4" /> },
]

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('users').select('display_name').eq('id', user.id).single()
    : { data: null }
  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'User'
  return (
    <DashboardShell navItems={ADMIN_NAV} title="Admin HQ" role="admin" userName={displayName}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black text-white">Command Center</h2>
          <p className="text-slate-400 text-sm mt-0.5">Platform-wide overview.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardMetricCard label="Total Creators" value={MOCK_STATS.totalCreators.toLocaleString()} delta="+124 this week" deltaPositive accent icon={<Users className="w-4 h-4" />} />
          <DashboardMetricCard label="Total Brands" value={MOCK_STATS.totalBrands.toLocaleString()} delta="+8 this week" deltaPositive icon={<Shield className="w-4 h-4" />} />
          <DashboardMetricCard label="Live Campaigns" value={MOCK_STATS.totalCampaigns.toString()} icon={<Megaphone className="w-4 h-4" />} />
          <DashboardMetricCard label="Total Paid Out" value={`$${(MOCK_STATS.totalPaidOut / 1000).toFixed(0)}K`} delta="+$24K this month" deltaPositive icon={<BarChart3 className="w-4 h-4" />} />
        </div>

        <GlassCard padding="md">
          <h3 className="text-sm font-semibold text-white mb-3">Platform Activity</h3>
          <div className="divide-y divide-[#1e1e30]">
            <ActivityFeedItem type="application" title="New creator signup" description="@neuralcreator2 joined as creator" time="5m ago" isNew />
            <ActivityFeedItem type="deal" title="Campaign launched" description="RingDing — SaaS Growth Q3" time="1h ago" isNew />
            <ActivityFeedItem type="payout" title="Payout processed" description="$420 to @gingerbreadman" time="2h ago" />
            <ActivityFeedItem type="badge" title="Sync Seal awarded" description="Top Earner → @neuralcreator" time="1d ago" />
            <ActivityFeedItem type="message" title="Brand verified" description="AdVelocity passed brand review" time="2d ago" />
          </div>
        </GlassCard>
      </div>
    </DashboardShell>
  )
}
