import type { Metadata } from 'next'
import { BarChart3, Megaphone, Globe, Home, Users } from 'lucide-react'
import DashboardShell from '@/components/layout/DashboardShell'
import HouseBrandCard from '@/components/ui/HouseBrandCard'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'House Brands — Admin HQ',
  robots: { index: false, follow: false },
}

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/admin/users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { href: '/admin/house-brands', label: 'House Brands', icon: <Home className="w-4 h-4" /> },
  { href: '/admin/campaigns', label: 'All Campaigns', icon: <Megaphone className="w-4 h-4" /> },
  { href: '/admin/seo', label: 'SEO Manager', icon: <Globe className="w-4 h-4" /> },
]

interface HouseBrandRow {
  id: string
  name: string
  slug: string
  tagline: string
  category: string
  commission_structure: string
  status: string
}

export default async function AdminHouseBrandsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createSupabaseAdminClient()

  const { data: profile } = user
    ? await admin.from('users').select('display_name').eq('id', user.id).single()
    : { data: null }

  const { data: brands } = await admin
    .from('house_brands')
    .select('id, name, slug, tagline, category, commission_structure, status')
    .order('name', { ascending: true })

  const normalised = ((brands ?? []) as HouseBrandRow[]).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    tagline: b.tagline,
    category: b.category,
    commission: b.commission_structure,
    status: (['active', 'paused', 'draft'].includes(b.status) ? b.status : 'draft') as 'active' | 'paused' | 'draft',
    campaigns: 0,
    description: b.tagline,
  }))

  return (
    <DashboardShell navItems={ADMIN_NAV} title="House Brands" role="admin" userName={(profile as { display_name: string } | null)?.display_name ?? 'Admin'}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {normalised.map((b) => (
          <HouseBrandCard key={b.id} {...b} />
        ))}
        {!normalised.length && (
          <p className="text-sm text-slate-600 col-span-3 text-center py-12">No house brands yet</p>
        )}
      </div>
    </DashboardShell>
  )
}
