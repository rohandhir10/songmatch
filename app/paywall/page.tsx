import Link from "next/link";

// Web Pro page: pricing lives here, purchase lives in the mobile apps
// (App Store / Play billing). The web stays fully free until the native
// apps ship — this page says exactly that instead of faking checkout.
export const metadata = {
  title: "SongMatch Pro — Sing what suits your voice",
};

const TIERS = [
  {
    name: "Free",
    price: "₹0",
    points: [
      "Voice scan + range matches",
      "First 8 shelf songs",
      "Siren Glide drill",
      "Progress dashboard",
    ],
    cta: null as string | null,
    href: "/popular",
    ctaLabel: "Start singing",
  },
  {
    name: "Pro",
    price: "Coming with the apps",
    points: [
      "All 100 songs, all 8 genres",
      "Every drill + training plans",
      "Hum-charted note tiles",
      "Priority new drops",
    ],
    cta: null as string | null,
    href: "/popular",
    ctaLabel: "Browse the shelf",
  },
];

export default function PaywallPage() {
  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[-0.06em]">
            song<span className="text-[#c8ff3d]">match</span>
          </Link>
        </header>

        <section className="mx-auto max-w-2xl pt-16 text-center">
          <h1 className="text-5xl font-black tracking-[-0.07em] text-balance">
            SongMatch Pro.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#b8b8c0]">
            Subscriptions will live inside the iPhone and Android apps, paid
            through the App Store and Google Play. Until they ship, everything
            here is free — no card, no trial clock.
          </p>
        </section>

        <section className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={
                t.name === "Pro"
                  ? "rounded-3xl border border-[#c8ff3d]/40 bg-[#c8ff3d]/[0.05] p-8"
                  : "rounded-3xl border border-white/10 bg-white/[0.03] p-8"
              }
            >
              <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                {t.name.toUpperCase()}
              </div>
              <div className="mt-2 text-3xl font-black">{t.price}</div>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[#b8b8c0]">
                {t.points.map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
              <Link
                href={t.href}
                className={
                  t.name === "Pro"
                    ? "mt-6 block rounded-2xl border border-[#c8ff3d]/40 px-6 py-3 text-center text-sm font-black text-[#c8ff3d] hover:bg-[#c8ff3d]/[0.08]"
                    : "mt-6 block rounded-2xl bg-[#c8ff3d] px-6 py-3 text-center text-sm font-black text-black"
                }
              >
                {t.ctaLabel}
              </Link>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
