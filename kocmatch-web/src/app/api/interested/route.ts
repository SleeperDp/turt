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
    .from("user_choices")
    .select("chosen_id, created_at, removed")
    .eq("chooser_id", user.id)
    .eq("decision", "interested")
    .eq("removed", false)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = Array.from(new Set((rows ?? []).map((r) => r.chosen_id)));
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, username").in("id", ids)
    : { data: [] as { id: string; username: string }[] };

  const map = new Map((profiles ?? []).map((p) => [p.id, p.username] as const));

  return NextResponse.json({
    items: (rows ?? []).map((r) => ({
      userId: r.chosen_id,
      username: map.get(r.chosen_id) ?? "Unknown",
      createdAt: r.created_at,
    })),
  });
}

