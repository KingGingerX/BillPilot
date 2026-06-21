'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Message {
  id: string
  sender_id: string
  body: string
  created_at: string
  is_read: boolean
}

interface Participant {
  name: string
  role: 'brand' | 'creator'
}

interface Props {
  conversationId: string
  currentUserId: string
  initialMessages: Message[]
  participant: Participant
  campaignRef: string | null
}

function timeStamp(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function MsgAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-10 h-10 text-xs'
  return (
    <div className={`${dim} rounded-xl flex items-center justify-center font-black shrink-0`}
      style={{ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.15)' }}>
      {initials}
    </div>
  )
}

export default function MessageThread({ conversationId, currentUserId, initialMessages, participant, campaignRef }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  async function handleSend() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')

    const res = await fetch(`/api/messages/${conversationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })

    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="flex items-center gap-4 mb-6 pb-5" style={{ borderBottom: '1px solid rgba(26,26,46,1)' }}>
        <Link href="/messages"
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-[#12121f] transition-all cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <MsgAvatar name={participant.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-white text-sm">{participant.name}</h2>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={participant.role === 'brand'
                ? { background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }
                : { background: 'rgba(0,245,255,0.08)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.15)' }
              }>
              {participant.role}
            </span>
          </div>
          {campaignRef && (
            <p className="text-[10px] text-[#00f5ff] opacity-70">{campaignRef}</p>
          )}
        </div>
      </div>

      <div className="space-y-4 mb-6 min-h-[300px]">
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-600 text-sm">No messages yet — start the conversation.</div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMe && <MsgAvatar name={participant.name} size="sm" />}
              <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={isMe ? {
                    background: 'linear-gradient(135deg, #00f5ff, #06b6d4)',
                    color: '#06060f',
                    borderRadius: '16px 16px 4px 16px',
                  } : {
                    background: '#12121f',
                    color: '#cbd5e1',
                    border: '1px solid rgba(26,26,46,1)',
                    borderRadius: '16px 16px 16px 4px',
                  }}>
                  {msg.body}
                </div>
                <span className="text-[10px] text-slate-600 px-1">{timeStamp(msg.created_at)}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-6">
        <div className="flex gap-3 items-end p-3 rounded-2xl"
          style={{ background: '#0d0d1a', border: '1px solid rgba(26,26,46,1)', boxShadow: '0 -8px 32px rgba(6,6,15,0.8)' }}>
          <textarea
            rows={1}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 resize-none focus:outline-none py-1.5 px-1 min-h-[36px] max-h-[120px]"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            aria-label="Send message"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#00f5ff', boxShadow: '0 0 12px rgba(0,245,255,0.4)' }}>
            <Send className="w-4 h-4 text-[#06060f]" />
          </button>
        </div>
      </div>
    </div>
  )
}
