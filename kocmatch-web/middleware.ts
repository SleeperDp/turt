import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getSupabaseEnv(): { url: string; key: string } | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  ).trim();
  if (!url || !key) return null;
  return { url, key };
}

/** Forward Set-Cookie headers from session refresh onto redirects. */
function copyCookies(from: NextResponse, to: NextResponse) {
  try {
    for (const c of from.cookies.getAll()) {
      to.cookies.set(c.name, c.value, c);
    }
  } catch (e) {
    console.error("[middleware] copyCookies:", e);
  }
}

export async function middleware(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) {
    return new NextResponse(
      [
        "Missing Supabase environment variables on the server.",
        "",
        "In Vercel → Project → Settings → Environment Variables, set:",
        "- NEXT_PUBLIC_SUPABASE_URL",
        "- NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
        "",
        "Redeploy after saving.",
      ].join("\n"),
      {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }
    );
  }

  // Supabase expects request cookie mutations to be visible to getAll(); rebuild response after setAll.
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            if (value) {
              request.cookies.set({ name, value, ...options });
            } else {
              request.cookies.delete(name);
            }
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            if (value) {
              supabaseResponse.cookies.set(name, value, options);
            } else {
              supabaseResponse.cookies.delete(name);
            }
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[middleware] getUser:", authError.message);
    }

    const sessionUser = authError ? null : user;
    const { pathname } = request.nextUrl;
    const isAuthPage = pathname.startsWith("/login");

    // Admin routing is handled in src/app/admin/layout.tsx and src/app/dashboard/layout.tsx
    // so middleware stays small for Vercel Edge (no RPC here).

    if (!sessionUser && !isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirect = NextResponse.redirect(url);
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }

    if (sessionUser && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirect = NextResponse.redirect(url);
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }

    return supabaseResponse;
  } catch (e) {
    console.error("[middleware]", e);
    return new NextResponse("Middleware error — check Vercel logs.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

export const config = {
  matcher: [
    /*
     * Skip: static assets, images, favicon, and API routes.
     * APIs use their own Supabase client; skipping reduces Edge invocations and failures.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
