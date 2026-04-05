import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { addDays, isoDate, isWeekend, startOfWeekMonday } from "@/lib/dates";
import { weightedPickManyUnique } from "@/lib/weightedPick";

type Decision = "interested" | "not_interested";

function clampWeight(w: number) {
  if (!Number.isFinite(w)) return 0;
  return Math.max(0.01, Math.min(1000, w));
}

export async function GET(request: NextRequest) {
  const { supabase } = createSupabaseRouteClient(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use server time plus admin offset and shift day boundary to 05:00 UTC
  const { data: settings } = await supabase
    .from("app_settings")
    .select("time_offset_minutes")
    .eq("id", 1)
    .maybeSingle();

  const offsetMinutes = settings?.time_offset_minutes ?? 0;
  const baseNow = new Date();
  const nowWithOffset = new Date(
    baseNow.getTime() + offsetMinutes * 60 * 1000
  );
  const now = new Date(nowWithOffset.getTime() - 5 * 60 * 60 * 1000);
  const today = isoDate(now);
  const weekStart = startOfWeekMonday(now);
  const weekEnd = addDays(weekStart, 7);
  const weekend = isWeekend(now);
  const weekday = now.getDay(); // 0 Sun ... 6 Sat
  const isFriday = weekday === 5;
  const isSaturday = nowWithOffset.getUTCDay() === 6;
  const isAfterSaturday5Utc = isSaturday && nowWithOffset.getUTCHours() >= 5;

  if (isAfterSaturday5Utc) {
    // Idempotent: safe to call multiple times (function only inserts missing matches).
    await supabase.rpc("run_weekly_matching", {
      p_week_start: isoDate(weekStart),
      p_week_end: isoDate(weekEnd),
    });
  }

  // Friday swap status (one per week)
  const { data: fridaySwapRow, error: fridaySwapError } = isFriday
    ? await supabase
        .from("friday_swaps")
        .select("id")
        .eq("chooser_id", user.id)
        .eq("week_start", isoDate(weekStart))
        .maybeSingle()
    : { data: null as { id: string } | null, error: null as Error | null };

  if (fridaySwapError) {
    return NextResponse.json({ error: fridaySwapError.message }, { status: 500 });
  }

  // Credits: interested choices this week (for UI Mon–Thu & weekend; hidden on Friday)
  const { count: creditsUsed, error: creditsError } = await supabase
    .from("user_choices")
    .select("id", { count: "exact", head: true })
    .eq("chooser_id", user.id)
    .eq("decision", "interested")
    .gte("created_at", weekStart.toISOString())
    .lt("created_at", weekEnd.toISOString());

  if (creditsError) {
    return NextResponse.json({ error: creditsError.message }, { status: 500 });
  }

  const creditsLimit = 3;

  // Ensure we have up to 2 offers for today
  const { data: existingOffers, error: offersError } = await supabase
    .from("user_offers")
    .select("offered_id")
    .eq("chooser_id", user.id)
    .eq("offered_date", today);

  if (offersError) {
    return NextResponse.json({ error: offersError.message }, { status: 500 });
  }

  const alreadyOfferedToday = new Set(
    (existingOffers ?? []).map((o) => o.offered_id)
  );

  const needed = Math.max(0, 2 - alreadyOfferedToday.size);

  // Do not create new offers on Friday or weekend.
  if (needed > 0 && !weekend && !isFriday) {
    // Get prior choices to influence weights; only exclude users we already liked.
    const { data: priorChoices, error: priorChoicesError } = await supabase
      .from("user_choices")
      .select("chosen_id, decision")
      .eq("chooser_id", user.id);

    if (priorChoicesError) {
      return NextResponse.json(
        { error: priorChoicesError.message },
        { status: 500 }
      );
    }

    const excluded = new Set<string>([user.id, ...alreadyOfferedToday]);
    const priorChoiceMap = new Map<string, Decision>();
    for (const c of priorChoices ?? []) {
      priorChoiceMap.set(c.chosen_id, c.decision as Decision);
      if (c.decision === "interested") {
        excluded.add(c.chosen_id);
      }
    }

    const { data: allProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "id, username, grade_level, gender, preferred_min_grade, preferred_max_grade, preferred_gender"
      )
      .neq("id", user.id);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    const { data: meProfile } = await supabase
      .from("profiles")
      .select(
        "id, grade_level, gender, preferred_min_grade, preferred_max_grade, preferred_gender"
      )
      .eq("id", user.id)
      .maybeSingle();

    const candidates = (allProfiles ?? []).filter((p) => {
      if (excluded.has(p.id)) return false;
      if (!meProfile) return false;
      const meGrade = meProfile.grade_level as number | null;
      const meGender = meProfile.gender as string | null;
      const meMin = meProfile.preferred_min_grade as number | null;
      const meMax = meProfile.preferred_max_grade as number | null;
      const mePrefGender = (meProfile.preferred_gender as string | null) ?? "any";

      const otherGrade = p.grade_level as number | null;
      const otherGender = p.gender as string | null;
      const otherMin = p.preferred_min_grade as number | null;
      const otherMax = p.preferred_max_grade as number | null;
      const otherPrefGender = (p.preferred_gender as string | null) ?? "any";

      // Only match against complete profiles (also excludes admin/test accounts)
      if (meGrade == null || meGender == null) return false;
      if (otherGrade == null || otherGender == null) return false;

      // Me's prefs -> candidate
      if (mePrefGender !== "any" && otherGender && otherGender !== mePrefGender)
        return false;
      if (meMin != null && otherGrade != null && otherGrade < meMin) return false;
      if (meMax != null && otherGrade != null && otherGrade > meMax) return false;

      // Candidate's prefs -> me
      if (otherPrefGender !== "any" && meGender && meGender !== otherPrefGender)
        return false;
      if (otherMin != null && meGrade != null && meGrade < otherMin) return false;
      if (otherMax != null && meGrade != null && meGrade > otherMax) return false;

      return true;
    });
    const candidateIds = candidates.map((c) => c.id);

    if (candidateIds.length > 0) {
      // Incoming choices to user from candidates (to boost if they liked me)
      const { data: incoming, error: incomingError } = await supabase
        .from("user_choices")
        .select("chooser_id, decision")
        .eq("chosen_id", user.id)
        .in("chooser_id", candidateIds);

      if (incomingError) {
        return NextResponse.json(
          { error: incomingError.message },
          { status: 500 }
        );
      }

      const incomingMap = new Map<string, Decision>();
      for (const row of incoming ?? []) {
        incomingMap.set(row.chooser_id, row.decision);
      }

      const weighted = candidates.map((c) => {
        let w = 1;
        const myDecision = priorChoiceMap.get(c.id);
        if (myDecision === "not_interested") {
          w /= 5;
        }
        const incomingDecision = incomingMap.get(c.id);
        if (incomingDecision === "interested") w *= 6; // drastic increase
        if (incomingDecision === "not_interested") w *= 0.6;
        return { item: c, weight: clampWeight(w) };
      });

      const picked = weightedPickManyUnique(weighted, needed, (c) => c.id);
      if (picked.length > 0) {
        const { error: insertError } = await supabase.from("user_offers").insert(
          picked.map((p) => ({
            chooser_id: user.id,
            offered_id: p.id,
            offered_date: today,
          }))
        );
        if (insertError) {
          return NextResponse.json(
            { error: insertError.message },
            { status: 500 }
          );
        }
      }
    }
  }

  // Return today's offers with usernames + (optional) existing decisions
  const { data: finalOffers, error: finalOffersError } = await supabase
    .from("user_offers")
    .select("offered_id")
    .eq("chooser_id", user.id)
    .eq("offered_date", today);

  if (finalOffersError) {
    return NextResponse.json(
      { error: finalOffersError.message },
      { status: 500 }
    );
  }

  const offeredIds = Array.from(
    new Set((finalOffers ?? []).map((o) => o.offered_id))
  );

  const { data: offerProfiles } = offeredIds.length
    ? await supabase
        .from("profiles")
        .select("id, username")
        .in("id", offeredIds)
    : { data: [] as { id: string; username: string }[] };

  const profileMap = new Map(
    (offerProfiles ?? []).map((p) => [p.id, p.username] as const)
  );

  // Decisions for today's offers so we can lock cards after a choice
  const { data: todayChoicesRows } = offeredIds.length
    ? await supabase
        .from("user_choices")
        .select("chosen_id, decision")
        .eq("chooser_id", user.id)
        .in("chosen_id", offeredIds)
    : { data: [] as { chosen_id: string; decision: Decision }[] };

  const todayDecisionMap = new Map(
    (todayChoicesRows ?? []).map(
      (r) => [r.chosen_id, r.decision] as [string, Decision]
    )
  );

  // Friday list: all offers for this week (Mon..Sun)
  const { data: weeklyOffers } = isFriday
    ? await supabase
        .from("user_offers")
        .select("offered_id, offered_date")
        .eq("chooser_id", user.id)
        .gte("offered_date", isoDate(weekStart))
        .lt("offered_date", isoDate(weekEnd))
        .order("offered_date", { ascending: false })
    : { data: [] as { offered_id: string; offered_date: string }[] };

  const weeklyIds = Array.from(
    new Set((weeklyOffers ?? []).map((o) => o.offered_id))
  );

  const { data: weeklyProfiles } = isFriday && weeklyIds.length
    ? await supabase
        .from("profiles")
        .select("id, username")
        .in("id", weeklyIds)
    : { data: [] as { id: string; username: string }[] };

  const weeklyProfileMap = new Map(
    (weeklyProfiles ?? []).map((p) => [p.id, p.username] as const)
  );

  // Decisions for weekly offers
  const { data: weeklyChoicesRows } = isFriday && weeklyIds.length
    ? await supabase
        .from("user_choices")
        .select("chosen_id, decision")
        .eq("chooser_id", user.id)
        .in("chosen_id", weeklyIds)
    : { data: [] as { chosen_id: string; decision: Decision }[] };

  const weeklyDecisionMap = new Map(
    (weeklyChoicesRows ?? []).map(
      (r) => [r.chosen_id, r.decision] as [string, Decision]
    )
  );

  return NextResponse.json({
    today,
    weekend,
    friday: isFriday,
    fridaySwapUsed: Boolean(fridaySwapRow),
    creditsUsed: creditsUsed ?? 0,
    creditsLimit,
    choices: isFriday
      ? []
      : offeredIds.map((id) => ({
          offeredId: id,
          username: profileMap.get(id) ?? "Unknown",
          decision: todayDecisionMap.get(id) ?? null,
        })),
    weeklyOffers: (weeklyOffers ?? []).map((o) => ({
      offeredId: o.offered_id,
      username: weeklyProfileMap.get(o.offered_id) ?? "Unknown",
      offeredDate: o.offered_date,
      decision: weeklyDecisionMap.get(o.offered_id) ?? null,
    })),
    noCandidates: offeredIds.length === 0,
  });
}

