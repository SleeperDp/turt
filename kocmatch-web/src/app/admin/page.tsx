 "use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Logo from "../LOGO.jpg";

type AdminUser = {
  id: string;
  username: string;
  grade_level: number | null;
  gender: string | null;
};

type AdminUserDetails = {
  profile: AdminUser;
  choices: {
    chosenId: string;
    username: string;
    decision: string;
    removed: boolean;
    createdAt: string;
  }[];
  matches: { userId: string; username: string; createdAt: string }[];
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const [savingOffset, setSavingOffset] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<AdminUserDetails | null>(
    null
  );

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        const { data: isAdminResult } = await supabase.rpc("is_admin");
        if (!isAdminResult) {
          router.push("/dashboard");
          return;
        }

        const [settingsRes, usersRes] = await Promise.all([
          fetch("/api/admin/settings"),
          fetch("/api/admin/users"),
        ]);
        const settingsJson = await settingsRes.json();
        const usersJson = await usersRes.json();
        if (!settingsRes.ok) throw new Error(settingsJson.error ?? "Error");
        if (!usersRes.ok) throw new Error(usersJson.error ?? "Error");
        setTimeOffset(settingsJson.timeOffsetMinutes ?? 0);
        setUsers(usersJson.users ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [router]);

  async function saveOffset() {
    setSavingOffset(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timeOffsetMinutes: timeOffset }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setTimeOffset(json.timeOffsetMinutes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSavingOffset(false);
    }
  }

  async function loadUserDetails(id: string) {
    setSelectedId(id);
    setSelectedDetails(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setSelectedDetails(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--background-strong),transparent_55%),radial-gradient(circle_at_bottom_right,var(--accent-soft),transparent_55%),var(--background)] text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-emerald-100/70 bg-white/80 backdrop-blur dark:border-emerald-900/50 dark:bg-black/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-emerald-600/20 ring-1 ring-emerald-200/40 dark:ring-emerald-900/50">
              <Image
                src={Logo}
                alt="turt logo"
                fill
                sizes="36px"
                className="object-cover scale-150"
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Turt Admin
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Admin controls & users
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10 space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/80">
          <h1 className="text-2xl font-semibold tracking-tight text-emerald-950 dark:text-emerald-100">
            Time override
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Adjust the logical app time (in minutes offset from real UTC) for
            testing the daily picks and Friday/Saturday behavior.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              value={timeOffset}
              onChange={(e) => setTimeOffset(Number(e.target.value || 0))}
              className="w-32 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none ring-2 ring-transparent focus:border-emerald-400 focus:ring-emerald-100 dark:border-emerald-900/60 dark:bg-black/40 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/40"
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-300">
              minutes offset from real time (negative = earlier).
            </span>
            <button
              type="button"
              disabled={savingOffset}
              onClick={saveOffset}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {savingOffset ? "Saving…" : "Save"}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-1 rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/80">
            <h2 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
              Users
            </h2>
            <div className="mt-3 max-h-96 space-y-1 overflow-auto text-sm">
              {loading ? (
                <div className="text-zinc-600 dark:text-zinc-300">Loading…</div>
              ) : users.length === 0 ? (
                <div className="text-zinc-600 dark:text-zinc-300">
                  No users yet.
                </div>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => loadUserDetails(u.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-white/10 ${
                      selectedId === u.id
                        ? "bg-emerald-50 dark:bg-white/10"
                        : ""
                    }`}
                  >
                    <span className="truncate">{u.username}</span>
                    <span className="ml-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {u.grade_level ?? "?"}/{u.gender ?? "?"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            {!selectedDetails ? (
              <div className="rounded-2xl border border-emerald-100 bg-white/90 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/80 dark:text-zinc-300">
                Select a user to see their interested picks and matches.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/80">
                  <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">
                    {selectedDetails.profile.username}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    Grade: {selectedDetails.profile.grade_level ?? "?"} • Gender:{" "}
                    {selectedDetails.profile.gender ?? "?"}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/80">
                  <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    Interested choices
                  </h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedDetails.choices.length === 0 ? (
                      <div className="text-zinc-600 dark:text-zinc-300">
                        No choices yet.
                      </div>
                    ) : (
                      selectedDetails.choices.map((c) => (
                        <div
                          key={c.chosenId}
                          className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/60 dark:bg-black/30"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-emerald-950 dark:text-emerald-100">
                              {c.username}
                            </div>
                            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                              {c.decision} • removed: {String(c.removed)}
                            </div>
                          </div>
                          <div className="ml-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {new Date(c.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/80">
                  <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    Matches
                  </h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedDetails.matches.length === 0 ? (
                      <div className="text-zinc-600 dark:text-zinc-300">
                        No matches yet.
                      </div>
                    ) : (
                      selectedDetails.matches.map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/60 dark:bg-black/30"
                        >
                          <div className="font-semibold text-emerald-950 dark:text-emerald-100">
                            {m.username}
                          </div>
                          <div className="ml-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

