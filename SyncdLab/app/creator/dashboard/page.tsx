import type { Metadata } from 'next'
import { BarChart3, DollarSign, FileText, Star, TrendingUp, Zap } from 'lucide-react'
import DashboardShell from '@/components/layout/DashboardShell'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DashboardMetricCard from '@/components/ui/DashboardMetricCard'
import GlassCard from '@/components/ui/GlassCard'
import ActivityFeedItem from '@/components/ui/ActivityFeedItem'
import CampaignCard from '@/components/ui/CampaignCard'
import UpgradePromptCard from '@/components/ui/UpgradePromptCard'
import SyncSeal from '@/components/ui/SyncSeal'
import { MOCK_CAMPAIGNS, SYNC_SEALS } from '@/lib/mock-data'

export const metadata: Metadata = {
  title: 'Creator HQ — Dashboard',
  robots: { index: false, follow: false },
}

const CREATOR_NAV = [
  { href: '/creator/dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/creator/profile', label: 'My Profile', icon: <Star className="w-4 h-4" /> },
  { href: '/creator/applications', label: 'Applications', icon: <FileText className="w-4 h-4" /> },
  { href: '/creator/deals', label: 'Active Deals', icon: <TrendingUp className="w-4 h-4" /> },
  { href: '/creator/earnings', label: 'Earnings', icon: <DollarSign className="w-4 h-4" /> },
  { href: '/creator/sync-seals', label: 'Sync Seals', icon: <Zap className="w-4 h-4" /> },
]

export default async function CreatorDashboard() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('users').select('display_name').eq('id', user.id).single()
    : { data: null }
  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'User'
  return (
    <DashboardShell navItems={CREATOR_NAV} title="Creator HQ" role="creator" userName={displayName}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black text-white">Welcome back 👋</h2>
          <p className="text-slate-400 text-sm mt-0.5">Here&apos;s your creator overview.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardMetricCard label="Total Earned" value="$8,420" delta="+$420 this month" deltaPositive accent icon={<DollarSign className="w-4 h-4" />} />
          <DashboardMetricCard label="Active Deals" value="3" delta="+1 new" deltaPositive icon={<TrendingUp className="w-4 h-4" />} />
          <DashboardMetricCard label="Applications" value="14" delta="2 pending" deltaPositive={false} icon={<FileText className="w-4 h-4" />} />
          <DashboardMetricCard label="Sync Seals" value="2" icon={<Zap className="w-4 h-4" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Recommended Campaigns</h3>
              <a href="/marketplace" className="text-xs text-[#00f5ff] hover:underline">View all</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MOCK_CAMPAIGNS.slice(0, 4).map((c) => (
                <CampaignCard key={c.id} {...c} status={c.status as any} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <GlassCard padding="md">
              <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
              <div className="divide-y divide-[#1e1e30]">
                <ActivityFeedItem type="payout" title="Payout received" description="Revenue Sprint — $180" time="2h ago" isNew />
                <ActivityFeedItem type="application" title="Application approved" description="AdVelocity Agency Scale" time="1d ago" />
                <ActivityFeedItem type="badge" title="Sync Seal earned" description="Verified Creator badge" time="3d ago" />
                <ActivityFeedItem type="deal" title="Deal completed" description="Passive Income MasterClass" time="1w ago" />
              </div>
            </GlassCard>

            <GlassCard padding="md">
              <h3 className="text-sm font-semibold text-white mb-3">Your Sync Seals</h3>
              <div className="flex flex-wrap gap-3">
                <SyncSeal label="Verified" color="#00f5ff" size="md" animated />
                <SyncSeal label="Rising Star" color="#a78bfa" size="md" />
              </div>
              <a href="/creator/sync-seals" className="text-xs text-[#00f5ff] hover:underline mt-3 block">View all seals</a>
            </GlassCard>

            <UpgradePromptCard
              title="Upgrade to SyncPass"
              description="Unlock unlimited applications, priority status, and Lab Drops early access."
              ctaLabel="Get SyncPass — $19/mo"
            />
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
