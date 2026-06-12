import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/project(.*)',
  '/account(.*)',
  '/onboarding(.*)',
])

const isAuthRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, request) => {
  // Honour any upstream request-id (e.g. from a load balancer), otherwise mint one
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()

  if (isAuthRoute(request)) {
    const { userId } = await auth()
    if (userId) {
      const res = NextResponse.redirect(new URL('/dashboard', request.url))
      res.headers.set('x-request-id', requestId)
      return res
    }
    const res = NextResponse.next()
    res.headers.set('x-request-id', requestId)
    return res
  }

  if (isProtectedRoute(request)) {
    // Throws/redirects internally if not authenticated
    await auth.protect()
  }

  // Propagate the request-id to the route handler (via incoming request headers)
  // and reflect it back to the caller in the response headers.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('x-request-id', requestId)
  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
