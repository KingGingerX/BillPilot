import type { Metadata } from 'next'
import { BarChart3, Megaphone, Globe, Home, Users } from 'lucide-react'
import DashboardShell from '@/components/layout/DashboardShell'
import GlassCard from '@/components/ui/GlassCard'
import CampaignStatusPill from '@/components/ui/CampaignStatusPill'
import GlowButton from '@/components/ui/GlowButton'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { setCampaignStatus } from './actions'

export const metadata: Metadata = {
  title: 'All Campaigns — Admin HQ',
  robots: { index: false, follow: false },
}

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/admin/users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { href: '/admin/house-brands', label: 'House Brands', icon: <Home className="w-4 h-4" /> },
  { href: '/admin/campaigns', label: 'All Campaigns', icon: <Megaphone className="w-4 h-4" /> },
  { href: '/admin/seo', label: 'SEO Manager', icon: <Globe className="w-4 h-4" /> },
]

export default async function AdminCampaignsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createSupabaseAdminClient()

  const { data: profile } = user
    ? await admin.from('users').select('display_name').eq('id', user.id).single()
    : { data: null }

  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id, title, payout_model, commission_value, commission_type, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <DashboardShell navItems={ADMIN_NAV} title="All Campaigns" role="admin" userName={(profile as { display_name: string } | null)?.display_name ?? 'Admin'}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">{campaigns?.length ?? 0} campaigns total</p>
        </div>
        {((campaigns ?? []) as { id: string; title: string; payout_model: string; commission_value: number; commission_type: string; status: string }[]).map((c) => {
          const commission = c.commission_type === 'percentage' ? `${c.commission_value}%` : `$${c.commission_value}`
          return (
            <GlassCard key={c.id} hover padding="md">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{c.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{c.payout_model} · {commission}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <CampaignStatusPill status={c.status as 'active' | 'featured' | 'paused'} />
                  {c.status === 'pending' && (
                    <form action={setCampaignStatus.bind(null, c.id, 'active')}>
                      <GlowButton size="sm" type="submit">Approve</GlowButton>
                    </form>
                  )}
                  {(c.status === 'active' || c.status === 'featured') && (
                    <form action={setCampaignStatus.bind(null, c.id, 'paused')}>
                      <GlowButton size="sm" variant="ghost" type="submit">Pause</GlowButton>
                    </form>
                  )}
                  {c.status === 'paused' && (
                    <form action={setCampaignStatus.bind(null, c.id, 'active')}>
                      <GlowButton size="sm" type="submit">Resume</GlowButton>
                    </form>
                  )}
                  {c.status !== 'closed' && (
                    <form action={setCampaignStatus.bind(null, c.id, 'closed')}>
                      <GlowButton size="sm" variant="ghost" type="submit">Close</GlowButton>
                    </form>
                  )}
                </div>
              </div>
            </GlassCard>
          )
        })}
        {!campaigns?.length && (
          <p className="text-sm text-slate-600 text-center py-12">No campaigns yet</p>
        )}
      </div>
    </DashboardShell>
  )
}
