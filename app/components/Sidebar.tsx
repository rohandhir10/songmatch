"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Home",
    icon: "M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5",
  },
  {
    href: "/matches",
    label: "Matches",
    icon: "M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z",
  },
  {
    href: "/scan",
    label: "Scan",
    icon: "M8 3h8v12H8zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8",
  },
  {
    href: "/train",
    label: "Train",
    icon: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Zm0 0v14a2 2 0 0 0 2 2h12M9 8h7M9 12h7",
  },
  {
    href: "/dashboard",
    label: "Progress",
    icon: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  },
];

function tabFor(path: string): string {
  if (path === "/") return "/";
  if (path.startsWith("/learn") || path.startsWith("/train")) return "/train";
  if (path.startsWith("/dashboard")) return "/dashboard";
  if (
    path.startsWith("/popular") ||
    path.startsWith("/matches") ||
    path.startsWith("/karaoke") ||
    path.startsWith("/singalong")
  ) {
    return "/matches";
  }
  if (path.startsWith("/scan")) return "/scan";
  return path;
}

export default function Sidebar() {
  const pathname = usePathname();
  const current = tabFor(pathname);
  return (
    <aside className="sm-sidebar">
      <div className="sm-brand">
        song<span>match</span>
      </div>
      <nav className="sm-nav" aria-label="Primary">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={current === t.href ? "page" : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d={t.icon} />
            </svg>
            {t.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
