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

  const { data, error } = await supabase
    .from("app_settings")
    .select("time_offset_minutes")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ timeOffsetMinutes: data?.time_offset_minutes ?? 0 });
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json().catch(() => null)) as
    | { timeOffsetMinutes?: number }
    | null;
  const value = body?.timeOffsetMinutes;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  const clamped = Math.max(-7 * 24 * 60, Math.min(7 * 24 * 60, Math.round(value)));

  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, time_offset_minutes: clamped });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, timeOffsetMinutes: clamped });
}

