import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createSupabaseAdminClient()

  const { data: conversations, error } = await admin
    .from('conversations')
    .select('id, participant_a, participant_b, campaign_ref_id, last_message_at')
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = await Promise.all(
    (conversations ?? []).map(async (conv) => {
      const otherId = conv.participant_a === user.id ? conv.participant_b : conv.participant_a

      const [{ data: other }, { data: lastMsg }, { count: unread }] = await Promise.all([
        admin.from('users').select('display_name, role').eq('id', otherId).single(),
        admin.from('messages').select('body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1).single(),
        admin.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', conv.id).eq('is_read', false).neq('sender_id', user.id),
      ])

      let campaignRef: string | null = null
      if (conv.campaign_ref_id) {
        const { data: campaign } = await admin.from('campaigns').select('title').eq('id', conv.campaign_ref_id).single()
        campaignRef = campaign?.title ?? null
      }

      return {
        id: conv.id,
        participant: {
          id: otherId,
          name: other?.display_name ?? 'Unknown',
          role: (other?.role ?? 'creator') as 'brand' | 'creator',
          online: false,
        },
        lastMessage: lastMsg?.body ?? '',
        lastMessageAt: lastMsg?.created_at ?? conv.last_message_at,
        unread: unread ?? 0,
        campaignRef,
      }
    })
  )

  return NextResponse.json(result)
}
