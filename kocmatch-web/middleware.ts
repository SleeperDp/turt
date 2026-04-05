import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Edge middleware: avoid `@/lib/*` imports (Vercel Edge unsupported-module warnings). */
async function isAdminRpc(
  supabase: { rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }> }
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

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

/** Session refresh writes Set-Cookie on `from`; redirects must forward those cookies. */
function copyCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c);
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

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
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
    const isAdminPage = pathname.startsWith("/admin");
    const isDashboardPage = pathname.startsWith("/dashboard");
    const needsAdminCheck =
      isAdminPage || isAuthPage || isDashboardPage || pathname === "/";
    const isAdmin =
      sessionUser && needsAdminCheck ? await isAdminRpc(supabase) : false;

    if (!sessionUser && !isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirect = NextResponse.redirect(url);
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }

    if (sessionUser && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = isAdmin ? "/admin" : "/dashboard";
      const redirect = NextResponse.redirect(url);
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }

    if (sessionUser && isAdminPage && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirect = NextResponse.redirect(url);
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }

    if (sessionUser && isAdmin && (pathname === "/" || isDashboardPage)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
