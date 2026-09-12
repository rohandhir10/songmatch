import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="flex items-center justify-between">
          <span className="text-2xl font-black tracking-[-0.06em]">
            song<span className="text-[#c8ff3d]">match</span>
          </span>
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="text-sm text-[#b8b8c0] hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/matches"
              className="text-sm text-[#b8b8c0] hover:text-white"
            >
              My matches
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-2xl pt-24 text-center">
          <h1 className="text-5xl font-black tracking-[-0.06em] text-balance sm:text-6xl">
            Sing what suits your voice.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#b8b8c0]">
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

          <Link
            href="/singalong"
            className="mt-6 inline-block text-sm font-bold text-[#c8ff3d] hover:underline"
          >
            or sing along to your own music →
          </Link>
        </section>

        <section aria-label="How it works" className="mx-auto mt-24 max-w-3xl">
          <ol className="relative flex flex-col gap-0 md:flex-row">
            <JourneyStep
              n="1"
              title="Scan"
              body="Hum or sing for a few seconds. We map your usable range and voice profile."
              href="/scan"
            />
            <JourneyStep
              n="2"
              title="Match"
              body="Every song is scored on range fit, tessitura fit and difficulty — with key changes."
              href="/matches"
            />
            <JourneyStep
              n="3"
              title="Sing"
              body="Open your match in karaoke mode and perform it in the key that fits you."
              href="/matches"
              last
            />
          </ol>
        </section>

        <footer className="mt-20 pb-8 text-center text-xs text-[#8a8a94]">
          SongMatch — your voice, your songs.
        </footer>
      </div>
    </main>
  );
}

function JourneyStep({
  n,
  title,
  body,
  href,
  last = false,
}: {
  n: string;
  title: string;
  body: string;
  href: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex flex-1 gap-4 pb-10 md:flex-col md:gap-0 md:pb-0 md:pr-6 last:pb-0 md:last:pr-0">
      {!last && (
        <span
          aria-hidden
          className="absolute top-8 bottom-[-8px] left-[15px] w-px bg-white/10 md:top-[15px] md:bottom-auto md:left-[32px] md:h-px md:w-[calc(100%-40px)]"
        />
      )}
      <Link href={href} className="group flex flex-1 gap-4 md:block">
        <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c8ff3d]/40 bg-[#c8ff3d]/10 text-sm font-black text-[#c8ff3d]">
          {n}
        </span>
        <span className="md:mt-4 md:block">
          <span className="block text-lg font-black group-hover:text-[#c8ff3d]">
            {title}
          </span>
          <span className="mt-1 block max-w-[38ch] text-sm leading-6 text-[#b8b8c0]">
            {body}
          </span>
        </span>
      </Link>
    </li>
  );
}
