import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export function createSupabaseRouteClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Route handlers don't need to mutate cookies for our use-case.
      },
    },
  });

  return { supabase };
}

