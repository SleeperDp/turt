import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const { supabase } = createSupabaseRouteClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: isAdminResult, error: adminError } = await supabase.rpc(
    "is_admin"
  );
  if (adminError || !isAdminResult) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const userId = segments[segments.length - 1];

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, grade_level, gender")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: choices, error: choicesError } = await supabase
    .from("user_choices")
    .select("chosen_id, decision, created_at, removed")
    .eq("chooser_id", userId)
    .order("created_at", { ascending: false });

  if (choicesError) {
    return NextResponse.json({ error: choicesError.message }, { status: 500 });
  }

  const chosenIds = Array.from(
    new Set((choices ?? []).map((c) => c.chosen_id))
  );

  const { data: chosenProfiles } = chosenIds.length
    ? await supabase
        .from("profiles")
        .select("id, username")
        .in("id", chosenIds)
    : { data: [] as { id: string; username: string }[] };

  const chosenMap = new Map(
    (chosenProfiles ?? []).map((p) => [p.id, p.username] as const)
  );

  const { data: matchesRows, error: matchesError } = await supabase
    .from("user_matches")
    .select("user_a, user_b, created_at")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (matchesError) {
    return NextResponse.json({ error: matchesError.message }, { status: 500 });
  }

  const otherIds = Array.from(
    new Set(
      (matchesRows ?? []).map((m) =>
        m.user_a === userId ? m.user_b : m.user_a
      )
    )
  );

  const { data: matchProfiles } = otherIds.length
    ? await supabase
        .from("profiles")
        .select("id, username")
        .in("id", otherIds)
    : { data: [] as { id: string; username: string }[] };

  const matchMap = new Map(
    (matchProfiles ?? []).map((p) => [p.id, p.username] as const)
  );

  return NextResponse.json({
    profile,
    choices: (choices ?? []).map((c) => ({
      chosenId: c.chosen_id,
      username: chosenMap.get(c.chosen_id) ?? "Unknown",
      decision: c.decision,
      removed: c.removed,
      createdAt: c.created_at,
    })),
    matches: (matchesRows ?? []).map((m) => {
      const otherId = m.user_a === userId ? m.user_b : m.user_a;
      return {
        userId: otherId,
        username: matchMap.get(otherId) ?? "Unknown",
        createdAt: m.created_at,
      };
    }),
  });
}

