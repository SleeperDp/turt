import { NextResponse, type NextRequest } from "next/server";

/**
 * Vercel Edge + @supabase/ssr createServerClient has been crashing with
 * MIDDLEWARE_INVOCATION_FAILED for this project. Auth and redirects run in
 * server layouts instead; the browser Supabase client refreshes the session.
 */
export function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
