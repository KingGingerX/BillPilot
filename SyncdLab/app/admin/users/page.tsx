import type { Metadata } from 'next'
import { BarChart3, Users, Megaphone, Globe, Home, Shield, CheckCircle } from 'lucide-react'
import DashboardShell from '@/components/layout/DashboardShell'
import GlassCard from '@/components/ui/GlassCard'
import GlowButton from '@/components/ui/GlowButton'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { setUserRole, verifyCreator } from './actions'

export const metadata: Metadata = {
  title: 'User Management — Admin HQ',
  robots: { index: false, follow: false },
}

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/admin/users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { href: '/admin/house-brands', label: 'House Brands', icon: <Home className="w-4 h-4" /> },
  { href: '/admin/campaigns', label: 'All Campaigns', icon: <Megaphone className="w-4 h-4" /> },
  { href: '/admin/seo', label: 'SEO Manager', icon: <Globe className="w-4 h-4" /> },
]

function RolePill({ role }: { role: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    admin: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
    brand: { bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
    creator: { bg: 'rgba(0,245,255,0.08)', color: '#00f5ff' },
  }
  const s = styles[role] ?? styles.creator
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}22` }}>
      {role}
    </span>
  )
}

interface UserRow {
  id: string
  email: string
  role: string
  display_name: string | null
  created_at: string
  creator_profiles: { identity_verified: boolean }[] | null
}

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const admin = createSupabaseAdminClient()

  const { data: profile } = currentUser
    ? await admin.from('users').select('display_name').eq('id', currentUser.id).single()
    : { data: null }

  const { data: users } = await admin
    .from('users')
    .select('id, email, role, display_name, created_at, creator_profiles(identity_verified)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <DashboardShell navItems={ADMIN_NAV} title="User Management" role="admin" userName={(profile as { display_name: string } | null)?.display_name ?? 'Admin'}>
      <div className="space-y-3">
        <p className="text-sm text-slate-400">{users?.length ?? 0} users</p>

        {((users ?? []) as UserRow[]).map((u) => {
          const isVerified = u.creator_profiles?.[0]?.identity_verified ?? false
          return (
            <GlassCard key={u.id} hover padding="md">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-white text-sm truncate">
                      {u.display_name ?? u.email}
                    </span>
                    <RolePill role={u.role} />
                    {isVerified && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{u.email} · Joined {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {u.role === 'creator' && !isVerified && (
                    <form action={verifyCreator.bind(null, u.id)}>
                      <GlowButton size="sm" type="submit">
                        <CheckCircle className="w-3 h-3" /> Verify
                      </GlowButton>
                    </form>
                  )}
                  {u.role !== 'admin' && u.id !== currentUser?.id && (
                    <form action={setUserRole.bind(null, u.id, u.role === 'creator' ? 'brand' : 'creator')}>
                      <GlowButton size="sm" variant="ghost" type="submit">
                        <Shield className="w-3 h-3" />
                        {u.role === 'creator' ? 'Set Brand' : 'Set Creator'}
                      </GlowButton>
                    </form>
                  )}
                </div>
              </div>
            </GlassCard>
          )
        })}

        {!users?.length && (
          <p className="text-sm text-slate-600 text-center py-12">No users yet</p>
        )}
      </div>
    </DashboardShell>
  )
}
