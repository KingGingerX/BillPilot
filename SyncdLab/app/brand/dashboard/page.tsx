import type { Metadata } from 'next'
import { BarChart3, Users, DollarSign, Megaphone, Star, TrendingUp } from 'lucide-react'
import DashboardShell from '@/components/layout/DashboardShell'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DashboardMetricCard from '@/components/ui/DashboardMetricCard'
import GlassCard from '@/components/ui/GlassCard'
import GlowButton from '@/components/ui/GlowButton'
import ActivityFeedItem from '@/components/ui/ActivityFeedItem'
import CampaignStatusPill from '@/components/ui/CampaignStatusPill'

export const metadata: Metadata = {
  title: 'Brand HQ — Dashboard',
  robots: { index: false, follow: false },
}

const BRAND_NAV = [
  { href: '/brand/dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/brand/campaigns', label: 'Campaigns', icon: <Megaphone className="w-4 h-4" /> },
  { href: '/brand/applicants', label: 'Applicants', icon: <Users className="w-4 h-4" /> },
  { href: '/brand/supporter-circle', label: 'Supporter Circle', icon: <Star className="w-4 h-4" /> },
]

const CAMPAIGNS_PREVIEW = [
  { name: 'Revenue Sprint Q3', status: 'active' as const, applicants: 24, spend: 2400, conversions: 18 },
  { name: 'Summer Push — Paid!', status: 'active' as const, applicants: 11, spend: 550, conversions: 6 },
  { name: 'ELFF B2B Drive', status: 'pending' as const, applicants: 3, spend: 0, conversions: 0 },
]

export default async function BrandDashboard() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('users').select('display_name').eq('id', user.id).single()
    : { data: null }
  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'User'
  return (
    <DashboardShell navItems={BRAND_NAV} title="Brand HQ" role="brand" userName={displayName}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Brand Overview</h2>
            <p className="text-slate-400 text-sm mt-0.5">Your growth machine at a glance.</p>
          </div>
          <GlowButton size="sm">+ New Campaign</GlowButton>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardMetricCard label="Total Spend" value="$4,820" delta="+$1.2K vs last month" deltaPositive accent icon={<DollarSign className="w-4 h-4" />} />
          <DashboardMetricCard label="Active Campaigns" value="2" icon={<Megaphone className="w-4 h-4" />} />
          <DashboardMetricCard label="Total Applicants" value="38" delta="+12 this week" deltaPositive icon={<Users className="w-4 h-4" />} />
          <DashboardMetricCard label="Conversions" value="24" delta="+4 today" deltaPositive icon={<TrendingUp className="w-4 h-4" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <GlassCard padding="md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Campaigns</h3>
                <a href="/brand/campaigns" className="text-xs text-[#00f5ff] hover:underline">Manage all</a>
              </div>
              <div className="space-y-3">
                {CAMPAIGNS_PREVIEW.map((c) => (
                  <div key={c.name} className="flex items-center justify-between py-3 border-b border-[#1e1e30] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.applicants} applicants · ${c.spend} spent</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white">{c.conversions} conv.</span>
                      <CampaignStatusPill status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          <div className="space-y-4">
            <GlassCard padding="md">
              <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
              <div className="divide-y divide-[#1e1e30]">
                <ActivityFeedItem type="application" title="New applicant" description="@neuralcreator applied to Revenue Sprint" time="1h ago" isNew />
                <ActivityFeedItem type="deal" title="Conversion" description="Revenue Sprint — $67 sale" time="3h ago" />
                <ActivityFeedItem type="message" title="Creator message" description="@passivequeen sent a message" time="1d ago" />
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
