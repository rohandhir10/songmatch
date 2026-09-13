"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HISTORY_KEY, dayStreak, type PerformanceEntry } from "@/lib/history";
import { matchSongs } from "@/lib/matching";
import { popularSongs } from "@/lib/popular";
import type { VocalProfile } from "@/lib/pitch";

export default function HomePage() {
  const [profile, setProfile] = useState<VocalProfile | null>(null);
  const [history, setHistory] = useState<PerformanceEntry[]>([]);

  useEffect(() => {
    try {
      const p = localStorage.getItem("songmatch-profile");
      if (p) setProfile(JSON.parse(p) as VocalProfile);
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as PerformanceEntry[]);
    } catch {
      // Fresh state covers it.
    }
  }, []);

  const streak = dayStreak(history);
  const sung = history.filter(
    (e) => e.songId.startsWith("yt:") || e.songId.startsWith("file:")
  ).length;
  const matches = profile
    ? matchSongs(profile, popularSongs).slice(0, 4)
    : [];
  const best = matches[0];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "34px 34px 110px" }}>
      <div className="sm-eyebrow">
        {profile ? `Back to it${streak > 0 ? ` · ${streak}-day streak` : ""}` : "Welcome to SongMatch"}
      </div>
      <h1 className="sm-h1">Find the songs that feel like you.</h1>
      <p className="sm-lead">
        SongMatch turns your voice into a personal music map — then gives
        you the songs, keys and practice path that actually fit.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr .7fr", gap: 18, marginTop: 28 }} className="sm-hero-grid">
        <div className="sm-card">
          <span style={{ fontSize: 11, border: "1px solid rgba(255,255,255,.09)", borderRadius: 999, color: "#94959e", padding: "7px 10px" }}>
            {best ? `${best.score}% voice fit · curated for you` : "Scan to unlock your matches"}
          </span>
          <div style={{ fontSize: 12, color: "#94959e", marginTop: 24 }}>
            {best ? "TODAY'S BEST MATCH" : "START HERE"}
          </div>
          <div style={{ fontSize: 36, fontWeight: 950, letterSpacing: "-.05em", marginTop: 5 }}>
            {best ? best.song.title : "Map your voice"}
          </div>
          <div style={{ color: "#94959e", marginTop: 3 }}>
            {best
              ? `${best.song.artist}`
              : "Sixty seconds with your mic."}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            {best ? (
              <>
                <Link href="/popular" className="sm-btn-primary">Start singing →</Link>
                <Link href="/matches" className="sm-btn-secondary">See all matches</Link>
              </>
            ) : (
              <>
                <Link href="/scan" className="sm-btn-primary">Start voice scan →</Link>
                <Link href="/popular" className="sm-btn-secondary">Browse songs</Link>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <Link href="/starter" className="sm-btn-secondary">★ Starter songs — built in, works offline</Link>
          </div>
        </div>

        <div className="sm-card">
          <div className="sm-eyebrow">Your voice</div>
          <div style={{ fontSize: 50, fontWeight: 950, letterSpacing: "-.06em" }}>
            {profile ? `${profile.lowNote}–${profile.highNote}` : "—"}
          </div>
          <div style={{ color: "#94959e", fontSize: 12 }}>
            {profile ? `Usable range · ${profile.voiceType}${profile.weight ? ` · ${profile.weight}` : ""}` : "No scan yet"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 26 }}>
            {[
              [best ? `${best.score}%` : "—", "Match quality"],
              [`${streak}`, "Day streak"],
              [`${sung}`, "Songs sung"],
            ].map(([v, l]) => (
              <div key={l} style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.025)" }}>
                <strong style={{ display: "block", fontSize: 20 }}>{v}</strong>
                <span style={{ display: "block", color: "#94959e", fontSize: 10, marginTop: 5, textTransform: "uppercase", letterSpacing: ".08em" }}>{l}</span>
              </div>
            ))}
          </div>
          {!profile && (
            <Link href="/scan" className="sm-btn-secondary" style={{ width: "100%", textAlign: "center", marginTop: 16 }}>
              Scan my voice →
            </Link>
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <section style={{ marginTop: 42 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-.025em" }}>Made for your voice</div>
              <div style={{ color: "#94959e", fontSize: 12 }}>The next songs we think you will love.</div>
            </div>
            <Link href="/matches" style={{ color: "#c8ff3d", fontSize: 12, fontWeight: 800 }}>View all →</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 }}>
            {matches.map((m) => (
              <div key={m.song.id} className="sm-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{m.song.title}</div>
                    <div style={{ color: "#94959e", fontSize: 12 }}>{m.song.artist}</div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 950, color: "#c8ff3d" }}>{m.score}%</div>
                </div>
                <Link href="/popular" className="sm-btn-secondary" style={{ marginTop: 12, textAlign: "center" }}>
                  Sing this one
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 42 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-.025em" }}>Keep training</div>
            <div style={{ color: "#94959e", fontSize: 12 }}>Plans, drills and coaching that fit your voice.</div>
          </div>
          <Link href="/learn" style={{ color: "#c8ff3d", fontSize: 12, fontWeight: 800 }}>Open plans →</Link>
        </div>
        <div className="sm-card" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center", background: "#1a1b1f", color: "#c8ff3d", fontWeight: 900 }}>♪</div>
          <div>
            <b>First-Week Singer</b>
            <div style={{ color: "#94959e", fontSize: 12, marginTop: 3 }}>7 days · drills + your first performance</div>
          </div>
          <Link href="/learn" className="sm-btn-primary">Start</Link>
        </div>
      </section>
      <style>{`@media(max-width:980px){.sm-hero-grid{grid-template-columns:1fr !important}}`}</style>
    </div>
  );
}
