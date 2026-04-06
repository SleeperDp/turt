"use client";

import Image from "next/image";
import { useState } from "react";
import Logo from "../LOGO.jpg";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isAdmin as isAdminRpc } from "@/lib/isAdmin";

const SCHOOL_EMAIL_SUFFIX = "@stu.koc.k12.tr";

function usernameFromEmail(email: string) {
  return email.split("@")[0]?.trim() ?? "";
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female" | "other">("");
  const [preferredGender, setPreferredGender] = useState<
    "" | "male" | "female" | "other" | "any"
  >("");
  const [preferredMinGrade, setPreferredMinGrade] = useState("");
  const [preferredMaxGrade, setPreferredMaxGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSchoolEmail = email.trim().toLowerCase().endsWith(SCHOOL_EMAIL_SUFFIX);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (mode === "signup" && !cleanEmail.endsWith(SCHOOL_EMAIL_SUFFIX)) {
      setError("Please sign up with your school email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (mode === "signup") {
      const grade = Number(gradeLevel);
      const minG = Number(preferredMinGrade);
      const maxG = Number(preferredMaxGrade);
      if (!Number.isInteger(grade)) {
        setError("Please select your grade level.");
        return;
      }
      if (!gender) {
        setError("Please select your gender.");
        return;
      }
      if (!preferredGender) {
        setError("Please select your preferred gender.");
        return;
      }
      if (!Number.isInteger(minG) || !Number.isInteger(maxG) || minG > maxG) {
        setError("Please select a valid preferred grade range.");
        return;
      }
      if (minG < grade - 2 || maxG > grade + 2) {
        setError("Preferred grades must be within ±2 of your grade.");
        return;
      }
    }

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        const username = usernameFromEmail(cleanEmail);
        const { error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              username,
              grade_level: gradeLevel ? Number(gradeLevel) : null,
              gender: gender || null,
              preferred_min_grade: preferredMinGrade
                ? Number(preferredMinGrade)
                : null,
              preferred_max_grade: preferredMaxGrade
                ? Number(preferredMaxGrade)
                : null,
              preferred_gender: preferredGender || null,
            },
          },
        });
        if (signUpError) throw signUpError;

        // Email confirmation is typically required: keep user on /login.
        setError("Check your email to confirm your account, then sign in.");
        return;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInError) throw signInError;
      }

      await fetch("/api/profile/ensure", { method: "POST" });
      const isAdmin = await isAdminRpc(supabase);
      router.push(isAdmin ? "/admin" : "/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
        <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="relative p-10 md:p-12">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-32 top-0 h-full w-80 bg-emerald-400/30 blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent" />
              </div>

              <div className="relative">
                <h1 className="text-4xl font-semibold tracking-tight">
                  You&apos;ve seen eachother…
                </h1>
                <p className="mt-3 text-lg text-white/70">but not like this?</p>

                <div className="mt-10 space-y-3 text-sm leading-6 text-white/60">
                  <p>Quietly discover people already in your world.</p>
                  <p>Nothing is revealed unless it&apos;s mutual.</p>
                </div>
              </div>
            </div>

            <div className="p-10 md:p-12">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full">
                    <Image
                      src={Logo}
                      alt="turt logo"
                      fill
                      sizes="40px"
                      className="object-cover scale-150"
                    />
                  </div>
                  <div className="text-lg font-semibold tracking-tight">turt</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode((m) => (m === "signin" ? "signup" : "signin"));
                  }}
                  className="text-sm font-medium text-white/70 hover:text-white"
                >
                  {mode === "signin" ? "Sign up" : "Log in"}
                </button>
              </div>

              <form onSubmit={onSubmit} className="mt-10 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70" htmlFor="email">
                    School Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-emerald-400 focus:ring-emerald-400/20"
                  />
                  {mode === "signup" && email.length > 3 && !isSchoolEmail ? (
                    <p className="text-xs text-amber-300">
                      Please use your school email.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-emerald-400 focus:ring-emerald-400/20"
                  />
                </div>

                {mode === "signup" ? (
                  <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-white/70">
                      Profile details
                    </summary>
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-white/70" htmlFor="grade">
                            Grade level
                          </label>
                          <select
                            id="grade"
                            value={gradeLevel}
                            onChange={(e) => {
                              const value = e.target.value;
                              setGradeLevel(value);
                              const g = Number(value);
                              if (Number.isInteger(g)) {
                                const min = Math.max(1, g - 2);
                                const max = g + 2;
                                if (!preferredMinGrade) setPreferredMinGrade(String(min));
                                if (!preferredMaxGrade) setPreferredMaxGrade(String(max));
                              }
                            }}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-emerald-400 focus:ring-emerald-400/20"
                          >
                            <option value="">Select grade</option>
                            <option value="9">9</option>
                            <option value="10">10</option>
                            <option value="11">11</option>
                            <option value="12">12</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-white/70" htmlFor="gender">
                            Gender
                          </label>
                          <select
                            id="gender"
                            value={gender}
                            onChange={(e) =>
                              setGender(e.target.value as "" | "male" | "female" | "other")
                            }
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-emerald-400 focus:ring-emerald-400/20"
                          >
                            <option value="">Select gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-white/70" htmlFor="preferredGender">
                            Preferred gender
                          </label>
                          <select
                            id="preferredGender"
                            value={preferredGender}
                            onChange={(e) =>
                              setPreferredGender(
                                e.target.value as "" | "male" | "female" | "other" | "any"
                              )
                            }
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-emerald-400 focus:ring-emerald-400/20"
                          >
                            <option value="">Select preference</option>
                            <option value="any">Any</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-white/70">
                            Preferred grades
                          </label>
                          <div className="flex items-center gap-2">
                            <select
                              value={preferredMinGrade}
                              onChange={(e) => setPreferredMinGrade(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-emerald-400 focus:ring-emerald-400/20"
                            >
                              <option value="">Min</option>
                              <option value="9">9</option>
                              <option value="10">10</option>
                              <option value="11">11</option>
                              <option value="12">12</option>
                            </select>
                            <span className="text-xs text-white/50">to</span>
                            <select
                              value={preferredMaxGrade}
                              onChange={(e) => setPreferredMaxGrade(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-emerald-400 focus:ring-emerald-400/20"
                            >
                              <option value="">Max</option>
                              <option value="9">9</option>
                              <option value="10">10</option>
                              <option value="11">11</option>
                              <option value="12">12</option>
                            </select>
                          </div>
                          <p className="text-xs text-white/50">
                            Must be within ±2 of your grade.
                          </p>
                        </div>
                      </div>
                    </div>
                  </details>
                ) : null}

                {error ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/40 transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy
                    ? "Please wait…"
                    : mode === "signin"
                      ? "Log in"
                      : "Sign up"}
                </button>

                <div className="text-center text-xs text-white/50">
                  {mode === "signin" ? (
                    <span>
                      Not a member?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setMode("signup");
                        }}
                        className="font-medium text-white/70 hover:text-white"
                      >
                        Sign up
                      </button>
                    </span>
                  ) : (
                    <span>
                      Already a member?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setMode("signin");
                        }}
                        className="font-medium text-white/70 hover:text-white"
                      >
                        Log in
                      </button>
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

