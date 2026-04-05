import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { addDays, isoDate, startOfWeekMonday } from "@/lib/dates";

export async function POST(request: NextRequest) {
  const { supabase } = createSupabaseRouteClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!isFriday) {
    return NextResponse.json({ error: "Friday swap only." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | { addId?: string; removeId?: string }
    | null;

  const addId = body?.addId;
  const removeId = body?.removeId;
  if (!addId || !removeId || addId === removeId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const weekStart = startOfWeekMonday(logicalNow);
  const weekEnd = addDays(weekStart, 7);
  const weekStartIso = isoDate(weekStart);

  // One swap per week
  const { data: existingSwap, error: swapError } = await supabase
    .from("friday_swaps")
    .select("id")
    .eq("chooser_id", user.id)
    .eq("week_start", weekStartIso)
    .maybeSingle();

  if (swapError) {
    return NextResponse.json({ error: swapError.message }, { status: 500 });
  }
  if (existingSwap) {
    return NextResponse.json({ error: "Swap already used." }, { status: 400 });
  }

  // Validate: removeId must be an active interested choice in this week
  const { data: removeChoice, error: removeError } = await supabase
    .from("user_choices")
    .select("id, decision, removed, created_at")
    .eq("chooser_id", user.id)
    .eq("chosen_id", removeId)
    .maybeSingle();

  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 500 });
  }
  if (
    !removeChoice ||
    removeChoice.decision !== "interested" ||
    removeChoice.removed !== false
  ) {
    return NextResponse.json(
      { error: "Invalid remove target." },
      { status: 400 }
    );
  }

  // Validate: addId must be a not_interested choice in this week (not null)
  const { data: addChoice, error: addError } = await supabase
    .from("user_choices")
    .select("id, decision, created_at")
    .eq("chooser_id", user.id)
    .eq("chosen_id", addId)
    .maybeSingle();

  if (addError) {
    return NextResponse.json({ error: addError.message }, { status: 500 });
  }
  if (!addChoice || addChoice.decision !== "not_interested") {
    return NextResponse.json({ error: "Invalid add target." }, { status: 400 });
  }

  const removeCreated = new Date(removeChoice.created_at);
  const addCreated = new Date(addChoice.created_at);
  if (
    removeCreated < weekStart ||
    removeCreated >= weekEnd ||
    addCreated < weekStart ||
    addCreated >= weekEnd
  ) {
    return NextResponse.json(
      { error: "Targets must be from this week." },
      { status: 400 }
    );
  }

  // Apply swap
  const { error: upd1 } = await supabase
    .from("user_choices")
    .update({ decision: "not_interested", removed: false })
    .eq("chooser_id", user.id)
    .eq("chosen_id", removeId);
  if (upd1) return NextResponse.json({ error: upd1.message }, { status: 500 });

  const { error: upd2 } = await supabase
    .from("user_choices")
    .update({ decision: "interested", removed: false })
    .eq("chooser_id", user.id)
    .eq("chosen_id", addId);
  if (upd2) return NextResponse.json({ error: upd2.message }, { status: 500 });

  const { error: ins } = await supabase.from("friday_swaps").insert({
    chooser_id: user.id,
    week_start: weekStartIso,
    add_id: addId,
    remove_id: removeId,
  });
  if (ins) return NextResponse.json({ error: ins.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

