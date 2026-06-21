import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageSquare, Search, Zap } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Messages — SyncdLab',
  robots: { index: false, follow: false },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function RoleTag({ role }: { role: 'brand' | 'creator' }) {
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
      style={role === 'brand'
        ? { background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }
        : { background: 'rgba(0,245,255,0.08)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.15)' }
      }>
      {role}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
      style={{ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.15)' }}>
      {initials}
    </div>
  )
}

interface Conversation {
  id: string
  participant: { id: string; name: string; role: 'brand' | 'creator' }
  lastMessage: string
  lastMessageAt: string
  unread: number
  campaignRef: string | null
}

async function getConversations(userId: string): Promise<Conversation[]> {
  const admin = createSupabaseAdminClient()
  const { data: conversations } = await admin
    .from('conversations')
    .select('id, participant_a, participant_b, campaign_ref_id, last_message_at')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false })

  if (!conversations?.length) return []

  return Promise.all(
    conversations.map(async (conv: { id: string; participant_a: string; participant_b: string; campaign_ref_id: string | null; last_message_at: string }) => {
      const otherId = conv.participant_a === userId ? conv.participant_b : conv.participant_a
      const [{ data: other }, { data: lastMsg }, { count: unread }] = await Promise.all([
        admin.from('users').select('display_name, role').eq('id', otherId).single(),
        admin.from('messages').select('body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1).single(),
        admin.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', conv.id).eq('is_read', false).neq('sender_id', userId),
      ])
      return {
        id: conv.id,
        participant: { id: otherId, name: (other as { display_name: string; role: string } | null)?.display_name ?? 'Unknown', role: ((other as { display_name: string; role: string } | null)?.role ?? 'creator') as 'brand' | 'creator' },
        lastMessage: (lastMsg as { body: string; created_at: string } | null)?.body ?? '',
        lastMessageAt: (lastMsg as { body: string; created_at: string } | null)?.created_at ?? conv.last_message_at,
        unread: unread ?? 0,
        campaignRef: null,
      }
    })
  )
}

export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/messages')

  const conversations = await getConversations(user.id)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold text-[#00f5ff] uppercase tracking-[0.2em] mb-1">Inbox</p>
          <h1 className="text-2xl font-black text-white">Messages</h1>
        </div>
        <Link href="/messages/new"
          className="relative group inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#06060f] rounded-xl overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00f5ff]"
          style={{ background: '#00f5ff', boxShadow: '0 0 16px rgba(0,245,255,0.35)' }}>
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />
          <MessageSquare className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">New Message</span>
        </Link>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
        <input type="text" placeholder="Search conversations..."
          className="w-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00f5ff]"
          style={{ background: '#0d0d1a', border: '1px solid rgba(26,26,46,1)' }} />
      </div>

      {conversations.length === 0 ? (
        <div className="mt-8 text-center py-16 rounded-xl" style={{ border: '1px dashed rgba(26,26,46,1)' }}>
          <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-600">No conversations yet</p>
          <p className="text-xs text-slate-700 mt-1">Start a conversation by messaging a brand or creator</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link key={conv.id} href={`/messages/${conv.id}`}>
              <div className="flex items-start gap-4 p-4 rounded-xl transition-all duration-200 cursor-pointer group"
                style={{
                  background: conv.unread > 0 ? 'rgba(0,245,255,0.03)' : '#0d0d1a',
                  border: conv.unread > 0 ? '1px solid rgba(0,245,255,0.12)' : '1px solid rgba(26,26,46,1)',
                }}>
                <Avatar name={conv.participant.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-white text-sm">{conv.participant.name}</span>
                    <RoleTag role={conv.participant.role} />
                    {conv.unread > 0 && (
                      <span className="ml-auto w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center"
                        style={{ background: '#00f5ff', color: '#06060f' }}>
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  {conv.campaignRef && (
                    <p className="text-[10px] text-[#00f5ff] opacity-70 mb-1 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" />{conv.campaignRef}
                    </p>
                  )}
                  <p className={`text-sm truncate ${conv.unread > 0 ? 'text-slate-300' : 'text-slate-500'}`}>
                    {conv.lastMessage || 'No messages yet'}
                  </p>
                </div>
                <span className="text-[11px] text-slate-600 shrink-0 mt-0.5">{timeAgo(conv.lastMessageAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
