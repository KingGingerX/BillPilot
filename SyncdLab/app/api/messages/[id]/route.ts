import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

async function verifyParticipant(userId: string, conversationId: string) {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .single()
  return !!data
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isParticipant = await verifyParticipant(user.id, id)
  if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createSupabaseAdminClient()
  const { data: messages, error } = await admin
    .from('messages')
    .select('id, sender_id, body, is_read, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', id)
    .eq('is_read', false)
    .neq('sender_id', user.id)

  return NextResponse.json({ messages: messages ?? [], currentUserId: user.id })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isParticipant = await verifyParticipant(user.id, id)
  if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Message body required' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data: message, error } = await admin
    .from('messages')
    .insert({ conversation_id: id, sender_id: user.id, body: body.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json(message)
}
