import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="flex items-center justify-between">
          <span className="text-2xl font-black tracking-[-0.06em]">
            song<span className="text-[#c8ff3d]">match</span>
          </span>
          <Link
            href="/matches"
            className="text-sm text-white/40 hover:text-white"
          >
            My matches
          </Link>
        </header>

        <section className="mx-auto max-w-2xl pt-24 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#c8ff3d]">
            Find your range. Sing your songs.
          </div>
          <h1 className="mt-4 text-5xl font-black tracking-[-0.06em] sm:text-6xl">
            Sing what suits your voice.
          </h1>
          <p className="mt-5 leading-7 text-white/40">
            Scan your voice in seconds, get songs matched to your range, then
            perform them in karaoke mode.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/scan"
              className="rounded-2xl bg-[#c8ff3d] px-8 py-4 text-lg font-black text-black transition hover:-translate-y-1"
            >
              Start voice scan →
            </Link>
            <Link
              href="/matches"
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-8 py-4 text-lg font-bold hover:bg-white/[0.08]"
            >
              View my matches
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-20 grid max-w-3xl gap-3 md:grid-cols-3">
          <Step
            n="1"
            title="Scan"
            body="Hum or sing for a few seconds. We detect your usable range and voice profile."
            href="/scan"
          />
          <Step
            n="2"
            title="Match"
            body="We score every song by range fit, tessitura fit and difficulty — plus key changes."
            href="/matches"
          />
          <Step
            n="3"
            title="Sing"
            body="Open your match in karaoke mode and perform it in the key that fits you."
            href="/matches"
          />
        </section>

        <footer className="mt-20 pb-8 text-center text-xs text-white/25">
          SongMatch — your voice, your songs.
        </footer>
      </div>
    </main>
  );
}

function Step({
  n,
  title,
  body,
  href,
}: {
  n: string;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:bg-white/[0.05]"
    >
      <div className="text-xs font-black text-[#c8ff3d]">{n}</div>
      <h2 className="mt-2 text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
    </Link>
  );
}
