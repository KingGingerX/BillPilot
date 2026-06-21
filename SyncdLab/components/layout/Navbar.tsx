'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, Zap, ChevronRight, MessageSquare, LogOut, LayoutDashboard, User } from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/lab-floor', label: 'Lab Floor' },
  { href: '/creators', label: 'Creators' },
  { href: '/brands', label: 'Brands' },
  { href: '/syncpass', label: 'SyncPass' },
  { href: '/pricing', label: 'Pricing' },
]

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
      style={{ background: 'rgba(0,245,255,0.12)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.2)' }}>
      {initials || <User className="w-3.5 h-3.5" />}
    </div>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<string>('creator')
  const pathname = usePathname()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  function applyUser(u: SupabaseUser | null) {
    setUser(u)
    setDisplayName(
      u?.user_metadata?.display_name ??
      u?.user_metadata?.first_name ??
      u?.email?.split('@')[0] ??
      ''
    )
    setRole(u?.user_metadata?.role ?? 'creator')
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => applyUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const dashboardHref = role === 'admin' ? '/admin' : role === 'brand' ? '/brand/dashboard' : '/creator/dashboard'

  return (
    <nav className="sticky top-0 z-50 w-full"
      style={{
        background: 'rgba(6,6,15,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(26,26,46,0.8)',
        boxShadow: '0 1px 0 rgba(0,245,255,0.04)',
      }}>

      <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,245,255,0.4) 30%, rgba(168,85,247,0.4) 70%, transparent 100%)',
          animation: 'border-glow 4s ease-in-out infinite',
        }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-[#00f5ff] focus:ring-offset-2 focus:ring-offset-[#06060f] rounded-lg">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-110"
              style={{ background: 'linear-gradient(135deg, #00f5ff, #0891b2)', boxShadow: '0 0 16px rgba(0,245,255,0.5)' }}>
              <Zap className="w-4 h-4 text-[#06060f]" fill="currentColor" />
            </div>
            <span className="font-black text-white text-lg tracking-tight">
              Syncd<span style={{ background: 'linear-gradient(135deg, #00f5ff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Lab</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map((l) => {
              const active = pathname === l.href
              return (
                <Link key={l.href} href={l.href}
                  className={clsx('relative px-3.5 py-2 text-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00f5ff] focus:ring-offset-1 focus:ring-offset-[#06060f]',
                    active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-[#12121f]')}
                  style={active ? { background: 'rgba(0,245,255,0.06)', color: '#00f5ff' } : undefined}>
                  {active && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full" style={{ background: '#00f5ff', boxShadow: '0 0 8px rgba(0,245,255,0.6)' }} />}
                  {l.label}
                </Link>
              )
            })}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/messages" aria-label="Messages"
              className="p-2 rounded-lg text-slate-500 hover:text-[#00f5ff] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00f5ff]">
              <MessageSquare className="w-4 h-4" />
            </Link>
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[#12121f] transition-all focus:outline-none focus:ring-2 focus:ring-[#00f5ff]">
                  <UserAvatar name={displayName} />
                  <span className="text-sm font-medium text-white max-w-[100px] truncate">{displayName}</span>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden z-50"
                    style={{ background: '#0d0d1a', border: '1px solid rgba(26,26,46,1)', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}>
                    <Link href={dashboardHref} onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-[#12121f] transition-all">
                      <LayoutDashboard className="w-3.5 h-3.5 text-[#00f5ff]" />
                      Dashboard
                    </Link>
                    <div style={{ borderTop: '1px solid rgba(26,26,46,1)' }}>
                      <button onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-400 hover:text-red-400 hover:bg-[#12121f] transition-all">
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login"
                  className="text-sm text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#00f5ff] focus:ring-offset-2 focus:ring-offset-[#06060f] rounded-lg px-2 py-1">
                  Sign In
                </Link>
                <Link href="/auth/sign-up"
                  className="relative group inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#06060f] rounded-xl overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00f5ff] focus:ring-offset-2 focus:ring-offset-[#06060f] cursor-pointer"
                  style={{ background: '#00f5ff', boxShadow: '0 0 15px rgba(0,245,255,0.35)' }}>
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
                  <Zap className="w-3.5 h-3.5 relative z-10" fill="currentColor" />
                  <span className="relative z-10">Get Started</span>
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#12121f] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00f5ff]">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden" style={{ borderTop: '1px solid rgba(26,26,46,0.8)', background: 'rgba(6,6,15,0.97)' }}>
          <div className="px-4 py-4 space-y-0.5">
            {NAV_LINKS.map((l) => {
              const active = pathname === l.href
              return (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className={clsx('flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all cursor-pointer',
                    active ? 'text-[#00f5ff]' : 'text-slate-400 hover:text-white hover:bg-[#12121f]')}
                  style={active ? { background: 'rgba(0,245,255,0.06)' } : undefined}>
                  {l.label}<ChevronRight className="w-4 h-4 opacity-40" />
                </Link>
              )
            })}
            <div className="pt-3 space-y-2" style={{ borderTop: '1px solid rgba(26,26,46,0.8)', marginTop: '8px' }}>
              {user ? (
                <>
                  <Link href={dashboardHref} onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-[#12121f] transition-all cursor-pointer">
                    Dashboard
                  </Link>
                  <button onClick={() => { handleSignOut(); setOpen(false) }}
                    className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:text-red-300 rounded-lg hover:bg-[#12121f] transition-all cursor-pointer">
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-[#12121f] transition-all cursor-pointer">
                    Sign In
                  </Link>
                  <Link href="/auth/sign-up" onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 text-sm font-semibold text-center text-[#06060f] rounded-xl cursor-pointer"
                    style={{ background: '#00f5ff', boxShadow: '0 0 12px rgba(0,245,255,0.3)' }}>
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
