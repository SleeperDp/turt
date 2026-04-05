import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdmin(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return Boolean(data);
}

