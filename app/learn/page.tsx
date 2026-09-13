"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HISTORY_KEY,
  type PerformanceEntry,
} from "@/lib/history";
import {
  PLANS,
  lessonStatus,
  planProgress,
  planStartsKey,
  type Plan,
} from "@/lib/curriculum";

function loadHistory(): PerformanceEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as PerformanceEntry[]) : [];
  } catch {
    return [];
  }
}

function loadStarts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(planStartsKey());
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export default function LearnPage() {
  const [history, setHistory] = useState<PerformanceEntry[]>([]);
  const [starts, setStarts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(PLANS[0].id);
  const [name, setName] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    setStarts(loadStarts());
    try {
      setName(localStorage.getItem("songmatch-name") ?? "");
    } catch {
      // ignore
    }
  }, []);

  function startPlan(plan: Plan) {
    const next = { ...starts, [plan.id]: Date.now() };
    setStarts(next);
    setOpenId(plan.id);
    try {
      localStorage.setItem(planStartsKey(), JSON.stringify(next));
    } catch {
      // Plan still works for this session.
    }
  }

  function saveName(v: string) {
    setName(v);
    try {
      localStorage.setItem("songmatch-name", v);
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[-0.06em]">
            song<span className="text-[#c8ff3d]">match</span>
          </Link>
        </header>

        <section className="mx-auto max-w-2xl pt-14 text-center">
          <h1 className="text-5xl font-black tracking-[-0.07em] text-balance">
            Training plans.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#b8b8c0]">
            Day-by-day drills that end in a song. Finish every lesson and
            the certificate is yours to keep.
          </p>
          <input
            value={name}
            onChange={(e) => saveName(e.target.value)}
            placeholder="Name for your certificate (optional)"
            aria-label="Name for your certificate"
            className="mx-auto mt-5 block w-full max-w-sm rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-[#8a8a94] focus:border-[#c8ff3d]/60 focus:outline-none"
          />
        </section>

        <section className="mx-auto mt-10 max-w-2xl space-y-4">
          {PLANS.map((plan) => {
            const since = starts[plan.id];
            const open = openId === plan.id;
            const prog = since
              ? planProgress(plan, history, since)
              : { done: 0, open: plan.lessons.length, complete: false };
            return (
              <div
                key={plan.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <button
                  onClick={() => setOpenId(open ? null : plan.id)}
                  aria-expanded={open}
                  className="block w-full text-left"
                >
                  <div className="text-xl font-black">{plan.title}</div>
                  <div className="mt-1 text-sm text-[#b8b8c0]">
                    {plan.tagline}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#c8ff3d]"
                      style={{
                        width: `${Math.round((100 * prog.done) / plan.lessons.length)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 text-xs font-bold text-[#8a8a94] tabular-nums">
                    {since
                      ? `${prog.done}/${plan.lessons.length} lessons`
                      : `${plan.lessons.length} lessons · not started`}
                  </div>
                </button>

                {open && (
                  <div className="mt-5">
                    {!since ? (
                      <button
                        onClick={() => startPlan(plan)}
                        className="w-full rounded-2xl bg-[#c8ff3d] px-6 py-4 font-black text-black"
                      >
                        Start this plan →
                      </button>
                    ) : prog.complete ? (
                      <div className="rounded-2xl border border-[#c8ff3d]/40 bg-[#c8ff3d]/[0.06] p-6 text-center">
                        <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                          CERTIFICATE
                        </div>
                        <div className="mt-2 text-2xl font-black">
                          {plan.title}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#b8b8c0]">
                          Awarded to {name.trim() || "this singer"} for
                          finishing all {plan.lessons.length} lessons.
                        </p>
                        <Link
                          href="/dashboard"
                          className="mt-4 inline-block rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold hover:bg-white/[0.08]"
                        >
                          View my progress
                        </Link>
                      </div>
                    ) : (
                      <ol className="space-y-2">
                        {plan.lessons.map((l, i) => {
                          const st = lessonStatus(history, l, since);
                          return (
                            <li
                              key={i}
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                            >
                              <span
                                aria-hidden
                                className={
                                  st.done
                                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c8ff3d] text-sm font-black text-black"
                                    : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-bold text-[#8a8a94] tabular-nums"
                                }
                              >
                                {st.done ? "✓" : l.day}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold">
                                  {l.title}
                                </div>
                                <div className="text-xs text-[#8a8a94]">
                                  {l.kind === "exercise"
                                    ? "Drill · goal "
                                    : "Performance · goal "}
                                  {l.goal}%
                                  {st.best !== null && !st.done
                                    ? ` · best ${st.best}%`
                                    : ""}
                                </div>
                              </div>
                              <Link
                                href={
                                  l.kind === "exercise" ? "/train" : "/popular"
                                }
                                className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-[#b8b8c0] hover:text-white min-h-[44px] inline-flex items-center"
                              >
                                Practice →
                              </Link>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
