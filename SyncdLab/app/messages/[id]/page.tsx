import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import MessageThread from '@/components/messages/MessageThread'

export default async function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/messages')

  const admin = createSupabaseAdminClient()

  const { data: conv } = await admin
    .from('conversations')
    .select('id, participant_a, participant_b, campaign_ref_id')
    .eq('id', id)
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .single()

  if (!conv) notFound()

  const otherId = conv.participant_a === user.id ? conv.participant_b : conv.participant_a

  const [{ data: messages }, { data: other }] = await Promise.all([
    admin.from('messages').select('id, sender_id, body, is_read, created_at').eq('conversation_id', id).order('created_at', { ascending: true }),
    admin.from('users').select('display_name, role').eq('id', otherId).single(),
  ])

  let campaignRef: string | null = null
  if (conv.campaign_ref_id) {
    const { data: campaign } = await admin.from('campaigns').select('title').eq('id', conv.campaign_ref_id).single()
    campaignRef = (campaign as { title: string } | null)?.title ?? null
  }

  await admin.from('messages').update({ is_read: true }).eq('conversation_id', id).eq('is_read', false).neq('sender_id', user.id)

  return (
    <MessageThread
      conversationId={id}
      currentUserId={user.id}
      initialMessages={messages ?? []}
      participant={{
        name: (other as { display_name: string; role: string } | null)?.display_name ?? 'Unknown',
        role: ((other as { display_name: string; role: string } | null)?.role ?? 'creator') as 'brand' | 'creator',
      }}
      campaignRef={campaignRef}
    />
  )
}
