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

  const body = (await request.json().catch(() => null)) as
    | { chosenId?: string }
    | null;

  const chosenId = body?.chosenId;
  if (!chosenId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_choices")
    .update({ removed: true })
    .eq("chooser_id", user.id)
    .eq("chosen_id", chosenId)
    .eq("decision", "interested");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

