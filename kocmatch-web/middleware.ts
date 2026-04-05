import { NextResponse, type NextRequest } from "next/server";

/** No Supabase on Edge (avoids Vercel MIDDLEWARE_INVOCATION_FAILED). Auth is in server layouts. */
export function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
