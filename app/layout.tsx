import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SongMatch — Sing what suits your voice",
  description: "Scan your vocal range, get songs matched to your voice, and perform them in karaoke mode.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SongMatch",
  },
};

export const viewport: Viewport = {
  themeColor: "#070708",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="sm-shell">
          <Sidebar />
          <div className="min-w-0">
            <header className="sm-topbar">
              <span className="sm-crumb">SongMatch</span>
              <Link href="/matches" className="sm-btn-secondary" style={{ padding: "9px 13px", fontSize: 12 }}>
                Find a song
              </Link>
            </header>
            <div className="pb-20">{children}</div>
          </div>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
