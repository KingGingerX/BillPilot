import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import GlowButton from '@/components/ui/GlowButton'
import NeonDivider from '@/components/ui/NeonDivider'
import { signUp } from '@/app/actions/auth'
import OAuthButton from '@/components/auth/OAuthButton'

export const metadata: Metadata = {
  title: 'Create Account — SyncdLab',
  robots: { index: false, follow: false },
}

interface SignUpPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#00f5ff] flex items-center justify-center shadow-neon">
              <Zap className="w-4 h-4 text-[#0a0a0f]" fill="currentColor" />
            </div>
            <span className="font-black text-white text-xl">Syncd<span className="text-[#00f5ff]">Lab</span></span>
          </Link>
          <h1 className="text-2xl font-black text-white">Join SyncdLab</h1>
          <p className="text-slate-400 text-sm mt-1">Create your free account and start getting backed</p>
        </div>

        <GlassCard glow padding="lg">
          {params.error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {decodeURIComponent(params.error)}
            </div>
          )}

          <form action={signUp} className="space-y-4">
            <div className="flex gap-2 mb-2">
              {[
                { label: 'Creator', value: 'creator', desc: 'Apply for campaigns' },
                { label: 'Brand', value: 'brand', desc: 'Launch campaigns' },
              ].map((r, i) => (
                <label key={r.label} className="flex-1 cursor-pointer">
                  <input type="radio" name="role" value={r.value} defaultChecked={i === 0} className="sr-only peer" />
                  <div className="border border-[#1e1e30] rounded-xl p-3 text-center peer-checked:border-[#00f5ff] peer-checked:bg-[#00f5ff08] transition-all">
                    <p className="text-sm font-semibold text-white">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  placeholder="John"
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#1e1e30] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f5ff40] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  placeholder="Doe"
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#1e1e30] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f5ff40] transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                required
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#1e1e30] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f5ff40] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#1e1e30] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f5ff40] transition-all"
              />
            </div>
            <GlowButton size="lg" type="submit" className="w-full">
              <Zap className="w-4 h-4" />
              Create Free Account
            </GlowButton>
            <p className="text-center text-xs text-slate-500">
              By signing up, you agree to our Terms and Privacy Policy.
            </p>
          </form>

          <NeonDivider className="my-6" label="or" />
          <OAuthButton />
          <NeonDivider className="my-6" label="already have an account" />

          <Link href="/auth/login" className="block text-center text-sm text-[#00f5ff] font-semibold hover:underline">
            Sign in instead
          </Link>
        </GlassCard>
      </div>
    </div>
  )
}
