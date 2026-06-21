'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

type CampaignStatus = 'draft' | 'pending' | 'active' | 'featured' | 'paused' | 'closed'

export async function setCampaignStatus(id: string, status: CampaignStatus) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/campaigns')
}
