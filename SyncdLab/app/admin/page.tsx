import type { Metadata } from 'next'
import { BarChart3, Users, Megaphone, Globe, Shield, Home } from 'lucide-react'
import DashboardShell from '@/components/layout/DashboardShell'
import DashboardMetricCard from '@/components/ui/DashboardMetricCard'
import GlassCard from '@/components/ui/GlassCard'
import ActivityFeedItem from '@/components/ui/ActivityFeedItem'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export const metadata: Metadata = {
  title: 'Admin HQ',
  robots: { index: false, follow: false },
}

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/admin/users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { href: '/admin/house-brands', label: 'House Brands', icon: <Home className="w-4 h-4" /> },
  { href: '/admin/campaigns', label: 'All Campaigns', icon: <Megaphone className="w-4 h-4" /> },
  { href: '/admin/seo', label: 'SEO Manager', icon: <Globe className="w-4 h-4" /> },
]

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createSupabaseAdminClient()

  const { data: profile } = user
    ? await admin.from('users').select('display_name').eq('id', user.id).single()
    : { data: null }
  const displayName = (profile as { display_name: string } | null)?.display_name ?? 'Admin'

  const [
    { count: totalCreators },
    { count: totalBrands },
    { count: totalCampaigns },
    { data: payoutRows },
    { data: recentUsers },
    { data: recentCampaigns },
  ] = await Promise.all([
    admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'brand'),
    admin.from('campaigns').select('*', { count: 'exact', head: true }).in('status', ['active', 'featured']),
    admin.from('payouts').select('amount').eq('status', 'paid'),
    admin.from('users').select('id, display_name, role, created_at').order('created_at', { ascending: false }).limit(5),
    admin.from('campaigns').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(3),
  ])

  const totalPaidOut = ((payoutRows ?? []) as { amount: string }[]).reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <DashboardShell navItems={ADMIN_NAV} title="Admin HQ" role="admin" userName={displayName}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black text-white">Command Center</h2>
          <p className="text-slate-400 text-sm mt-0.5">Platform-wide overview.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardMetricCard label="Total Creators" value={(totalCreators ?? 0).toLocaleString()} icon={<Users className="w-4 h-4" />} />
          <DashboardMetricCard label="Total Brands" value={(totalBrands ?? 0).toLocaleString()} icon={<Shield className="w-4 h-4" />} />
          <DashboardMetricCard label="Live Campaigns" value={(totalCampaigns ?? 0).toString()} icon={<Megaphone className="w-4 h-4" />} />
          <DashboardMetricCard label="Total Paid Out" value={`$${(totalPaidOut / 1000).toFixed(1)}K`} accent icon={<BarChart3 className="w-4 h-4" />} />
        </div>

        <GlassCard padding="md">
          <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
          <div className="divide-y divide-[#1e1e30]">
            {((recentUsers ?? []) as { id: string; display_name: string; role: string; created_at: string }[]).map((u) => (
              <ActivityFeedItem
                key={u.id}
                type="application"
                title={`New ${u.role} signup`}
                description={u.display_name ?? u.id}
                time={new Date(u.created_at).toLocaleDateString()}
                isNew
              />
            ))}
            {((recentCampaigns ?? []) as { id: string; title: string; status: string; created_at: string }[]).map((c) => (
              <ActivityFeedItem
                key={c.id}
                type="deal"
                title={`Campaign ${c.status}`}
                description={c.title}
                time={new Date(c.created_at).toLocaleDateString()}
              />
            ))}
            {!recentUsers?.length && !recentCampaigns?.length && (
              <p className="text-sm text-slate-600 py-4 text-center">No recent activity</p>
            )}
          </div>
        </GlassCard>
      </div>
    </DashboardShell>
  )
}
