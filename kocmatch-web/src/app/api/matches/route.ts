import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const { supabase } = createSupabaseRouteClient(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("user_matches")
    .select("user_a, user_b, created_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const otherIds = Array.from(
    new Set(
      (rows ?? []).map((r) => (r.user_a === user.id ? r.user_b : r.user_a))
    )
  );

  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("id, username").in("id", otherIds)
    : { data: [] as { id: string; username: string }[] };

  const map = new Map((profiles ?? []).map((p) => [p.id, p.username] as const));

  return NextResponse.json({
    matches: (rows ?? []).map((r) => {
      const otherId = r.user_a === user.id ? r.user_b : r.user_a;
      return {
        userId: otherId,
        username: map.get(otherId) ?? "Unknown",
        createdAt: r.created_at,
      };
    }),
  });
}

