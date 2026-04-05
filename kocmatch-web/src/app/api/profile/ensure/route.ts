import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const { supabase } = createSupabaseRouteClient(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username =
    (user.user_metadata?.username as string | undefined) ||
    (user.email?.split("@")[0] ?? "user");

  const gradeLevel = (user.user_metadata?.grade_level as number | null) ?? null;
  const gender = (user.user_metadata?.gender as string | null) ?? null;
  const preferredMinGrade =
    (user.user_metadata?.preferred_min_grade as number | null) ?? null;
  const preferredMaxGrade =
    (user.user_metadata?.preferred_max_grade as number | null) ?? null;
  const preferredGender =
    (user.user_metadata?.preferred_gender as string | null) ?? null;

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      username,
      grade_level: gradeLevel,
      gender,
      preferred_min_grade: preferredMinGrade,
      preferred_max_grade: preferredMaxGrade,
      preferred_gender: preferredGender,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

