import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import GlowButton from '@/components/ui/GlowButton'
import NeonDivider from '@/components/ui/NeonDivider'
import { signIn } from '@/app/actions/auth'
import OAuthButton from '@/components/auth/OAuthButton'

export const metadata: Metadata = {
  title: 'Sign In — SyncdLab',
  robots: { index: false, follow: false },
}

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
          <h1 className="text-2xl font-black text-white">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your SyncdLab account</p>
        </div>

        <GlassCard glow padding="lg">
          {params.error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {decodeURIComponent(params.error)}
            </div>
          )}
          {params.message && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              {decodeURIComponent(params.message)}
            </div>
          )}

          <form action={signIn} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-[#00f5ff] hover:underline">Forgot?</Link>
              </div>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#1e1e30] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f5ff40] transition-all"
              />
            </div>
            <GlowButton size="lg" type="submit" className="w-full">Sign In</GlowButton>
          </form>

          <NeonDivider className="my-6" label="or" />
          <OAuthButton />
          <NeonDivider className="my-6" label="no account yet" />
          <p className="text-center text-sm text-slate-400">
            <Link href="/auth/sign-up" className="text-[#00f5ff] font-semibold hover:underline">Sign up free</Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
