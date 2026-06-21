'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

async function assertAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') throw new Error('Unauthorized')
}

export async function setUserRole(userId: string, role: 'creator' | 'brand' | 'admin') {
  await assertAdmin()
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('users').update({ role }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function verifyCreator(userId: string) {
  await assertAdmin()
  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('creator_profiles')
    .update({ identity_verified: true })
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}
