import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_ROUTES = ['/creator', '/brand', '/admin', '/messages']
const ADMIN_ROUTES = ['/admin']
const BRAND_ROUTES = ['/brand']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const needsAuth = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  if (!needsAuth) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = (user.user_metadata?.role as string) ?? 'creator'

  if (ADMIN_ROUTES.some(r => pathname.startsWith(r)) && role !== 'admin') {
    return NextResponse.redirect(new URL('/creator/dashboard', request.url))
  }

  if (BRAND_ROUTES.some(r => pathname.startsWith(r)) && role !== 'brand' && role !== 'admin') {
    return NextResponse.redirect(new URL('/creator/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/creator/:path*',
    '/brand/:path*',
    '/admin/:path*',
    '/messages/:path*',
  ],
}
