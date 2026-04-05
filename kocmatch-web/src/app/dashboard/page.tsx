"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import SignOutButton from "./sign-out-button";
import Logo from "../LOGO.jpg";

type Decision = "interested" | "not_interested";

type TodayChoice = {
  offeredId: string;
  username: string;
  decision: Decision | null;
};
type WeeklyOffer = {
  offeredId: string;
  username: string;
  offeredDate: string;
  decision: Decision | null;
};
type InterestedItem = { userId: string; username: string; createdAt: string };
type MatchItem = { userId: string; username: string; createdAt: string };

type TodayResponse = {
  today: string;
  weekend: boolean;
  friday: boolean;
  fridaySwapUsed: boolean;
  creditsUsed: number;
  creditsLimit: number;
  choices: TodayChoice[];
  weeklyOffers: WeeklyOffer[];
  noCandidates: boolean;
};

function CandidateCard({
  candidate,
  busy,
  onDecision,
}: {
  candidate: TodayChoice;
  busy: boolean;
  onDecision: (decision: "interested" | "not_interested") => void;
}) {
  const isDecided = candidate.decision != null;

  return (
    <div className="rounded-3xl border border-emerald-100 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/70">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-emerald-200/70 dark:bg-emerald-900/40" />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-emerald-950 dark:text-emerald-100">
            {candidate.username}
          </div>
        </div>
      </div>
      <div className="mt-4">
        {isDecided ? (
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            You chose{" "}
            <span className="font-semibold text-emerald-800 dark:text-emerald-200">
              {candidate.decision === "interested" ? "Interested" : "Not interested"}
            </span>
            .
          </div>
        ) : busy ? (
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Saving your choice…
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onDecision("not_interested")}
              className="flex-1 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100 dark:hover:bg-white/10"
            >
              Not interested
            </button>
            <button
              onClick={() => onDecision("interested")}
              className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              Interested
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [interested, setInterested] = useState<InterestedItem[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapAddId, setSwapAddId] = useState<string | null>(null);
  const [swapRemoveId, setSwapRemoveId] = useState<string | null>(null);

  const creditsLeft = useMemo(() => {
    if (!today) return 0;
    return Math.max(0, today.creditsLimit - today.creditsUsed);
  }, [today]);

  const loadAll = useCallback(async () => {
    setError(null);
    const [todayRes, interestedRes, matchesRes] = await Promise.all([
      fetch("/api/choices/today", { cache: "no-store" }),
      fetch("/api/interested", { cache: "no-store" }),
      fetch("/api/matches", { cache: "no-store" }),
    ]);

    if (!todayRes.ok) throw new Error((await todayRes.json()).error ?? "Error");
    if (!interestedRes.ok)
      throw new Error((await interestedRes.json()).error ?? "Error");
    if (!matchesRes.ok)
      throw new Error((await matchesRes.json()).error ?? "Error");

    const todayJson = (await todayRes.json()) as TodayResponse;
    const interestedJson = (await interestedRes.json()) as {
      items: InterestedItem[];
    };
    const matchesJson = (await matchesRes.json()) as { matches: MatchItem[] };

    setToday(todayJson);
    setInterested(interestedJson.items);
    setMatches(matchesJson.matches);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/profile/ensure", { method: "POST" });
        await loadAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    })();
  }, [loadAll]);

  async function submitDecision(offeredId: string, decision: "interested" | "not_interested") {
    setError(null);
    setBusyId(offeredId);
    try {
      const res = await fetch("/api/choices/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offeredId, decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitFridaySwap(addId: string, removeId: string) {
    setError(null);
    setBusyId("friday_swap");
    try {
      const res = await fetch("/api/friday/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ addId, removeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setSwapAddId(null);
      setSwapRemoveId(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeInterested(userId: string) {
    setError(null);
    try {
      const res = await fetch("/api/interested/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chosenId: userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      await loadAll();
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
                Turt
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Dashboard
              </div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-lg shadow-emerald-100/30 backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/80 dark:shadow-none">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-emerald-950 dark:text-emerald-100">
                    Today’s picks
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    You get 2 picks per day.
                  </p>
                </div>
                {today && !today.friday ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100">
                    Credits left:{" "}
                    <span className="font-semibold">{creditsLeft}</span>
                  </div>
                ) : null}
              </div>

              {!today ? (
                <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">
                  Loading…
                </div>
              ) : today.friday ? (
                <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100">
                  No offers on Fridays. Use the list below to review this
                  week&apos;s choices.
                </div>
              ) : today.choices.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100">
                  No matches found for today’s picks.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {today.choices.map((c) => (
                    <CandidateCard
                      key={c.offeredId}
                      candidate={c}
                      busy={busyId === c.offeredId}
                      onDecision={(d) => submitDecision(c.offeredId, d)}
                    />
                  ))}
                </div>
              )}
            </div>

            {today?.friday ? (
              <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/70">
                <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">
                  Choices this week
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Everyone you were offered this week. You can adjust your
                  choices here by using exactly one swap.
                </p>
                {today.fridaySwapUsed ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100">
                    Swap already used for this week.
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100">
                    Pick one <span className="font-semibold">Not interested</span> to turn into{" "}
                    <span className="font-semibold">Interested</span>, and one{" "}
                    <span className="font-semibold">Interested</span> to turn into{" "}
                    <span className="font-semibold">Not interested</span>.
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  {today.weeklyOffers.length === 0 ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">
                      No offers yet this week.
                    </div>
                  ) : (
                    today.weeklyOffers.map((o) => (
                      <div
                        key={`${o.offeredId}-${o.offeredDate}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/60 dark:bg-black/30"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                            {o.username}
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            Offered: {o.offeredDate}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                            You chose{" "}
                            <span className="font-semibold">
                              {o.decision === "interested"
                                ? "Interested"
                                : o.decision === "not_interested"
                                  ? "Not interested"
                                  : "—"}
                            </span>
                            .
                          </div>
                          {!today.fridaySwapUsed &&
                          o.decision === "not_interested" ? (
                            <button
                              disabled={busyId != null}
                              onClick={() =>
                                setSwapAddId((cur) =>
                                  cur === o.offeredId ? null : o.offeredId
                                )
                              }
                              className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                                swapAddId === o.offeredId
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : "border-emerald-100 bg-white/90 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100 dark:hover:bg-white/10"
                              }`}
                            >
                              Select to add
                            </button>
                          ) : null}
                          {!today.fridaySwapUsed &&
                          o.decision === "interested" ? (
                            <button
                              disabled={busyId != null}
                              onClick={() =>
                                setSwapRemoveId((cur) =>
                                  cur === o.offeredId ? null : o.offeredId
                                )
                              }
                              className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                                swapRemoveId === o.offeredId
                                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                                  : "border-emerald-100 bg-white/90 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100 dark:hover:bg-white/10"
                              }`}
                            >
                              Select to remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {!today.fridaySwapUsed ? (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Add:{" "}
                      <span className="font-semibold">
                        {swapAddId ? "selected" : "none"}
                      </span>
                      {" · "}Remove:{" "}
                      <span className="font-semibold">
                        {swapRemoveId ? "selected" : "none"}
                      </span>
                    </div>
                    <button
                      disabled={
                        busyId != null || !swapAddId || !swapRemoveId
                      }
                      onClick={() => {
                        if (!swapAddId || !swapRemoveId) return;
                        submitFridaySwap(swapAddId, swapRemoveId);
                      }}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                    >
                      Confirm swap
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/70">
              <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">
                Interested
              </h2>
              {today && !today.friday ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Removing doesn&apos;t refund credits.
                </p>
              ) : null}
              <div className="mt-4 space-y-2">
                {interested.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    No interested picks yet.
                  </div>
                ) : (
                  interested.map((it) => (
                    <div
                      key={it.userId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/60 dark:bg-black/30"
                    >
                      <div className="truncate text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                        {it.username}
                      </div>
                      <button
                        onClick={() => removeInterested(it.userId)}
                        className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-[#020817]/70">
              <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">
                Matches
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Mutual “Interested” shows up here.
              </p>
              <div className="mt-4 space-y-2">
                {matches.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    No matches yet.
                  </div>
                ) : (
                  matches.map((m) => (
                    <div
                      key={m.userId}
                      className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm font-semibold text-emerald-950 dark:border-emerald-900/60 dark:bg-black/30 dark:text-emerald-100"
                    >
                      {m.username}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

