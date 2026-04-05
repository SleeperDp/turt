import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { addDays, startOfWeekMonday } from "@/lib/dates";

type Decision = "interested" | "not_interested";

export async function POST(request: NextRequest) {
  const { supabase } = createSupabaseRouteClient(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { offeredId?: string; decision?: Decision }
    | null;

  const offeredId = body?.offeredId;
  const decision = body?.decision;

  if (!offeredId || (decision !== "interested" && decision !== "not_interested")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (offeredId === user.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  // Weekly credit (3 interested per week) — not enforced on Fridays (swap day).
  const { data: settings } = await supabase
    .from("app_settings")
    .select("time_offset_minutes")
    .eq("id", 1)
    .maybeSingle();

  const offsetMinutes = settings?.time_offset_minutes ?? 0;
  const baseNow = new Date();
  const nowWithOffset = new Date(baseNow.getTime() + offsetMinutes * 60 * 1000);
  const logicalNow = new Date(nowWithOffset.getTime() - 5 * 60 * 60 * 1000);
  const isFriday = logicalNow.getDay() === 5;

  if (decision === "interested" && !isFriday) {
    const weekStart = startOfWeekMonday(logicalNow);
    const weekEnd = addDays(weekStart, 7);

    const { count: used, error: usedError } = await supabase
      .from("user_choices")
      .select("id", { count: "exact", head: true })
      .eq("chooser_id", user.id)
      .eq("decision", "interested")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString());

    if (usedError) {
      return NextResponse.json({ error: usedError.message }, { status: 500 });
    }

    if ((used ?? 0) >= 3) {
      return NextResponse.json(
        { error: "No credits left for this week." },
        { status: 400 }
      );
    }
  }

  // Upsert choice (idempotent)
  const { error: upsertError } = await supabase.from("user_choices").upsert({
    chooser_id: user.id,
    chosen_id: offeredId,
    decision,
    removed: false,
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

