"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        setBusy(false);
        router.push("/login");
        router.refresh();
      }}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-50 dark:hover:bg-white/10"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

