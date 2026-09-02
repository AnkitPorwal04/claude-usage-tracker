import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexCond = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-cond",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Usage Instrument",
  description: "Claude and Codex subscription usage, limits and cost telemetry",
};

/* Duplicates globals.css tokens so a failed stylesheet degrades dark, not white. */
const CRITICAL_SHELL_CSS = `:root{--ground:#0b0a09;--ink:#ece6da}
html{color-scheme:dark;background-color:#0b0a09}
body{background-color:#0b0a09;color:#ece6da;margin:0}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexMono.variable} ${plexCond.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_SHELL_CSS }} />
      </head>
      <body className="min-h-full">
        <div className="flex min-h-dvh">
          <SpineRail />
          <div className="flex min-w-0 flex-1 flex-col border-l border-rule">{children}</div>
        </div>
      </body>
    </html>
  );
}

function SpineRail() {
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-11 shrink-0 flex-col items-center justify-between py-5 sm:flex"
      aria-hidden
    >
      <svg viewBox="0 0 12 12" className="size-3 text-rule-3">
        <path d="M6 0V12M0 6H12" stroke="currentColor" strokeWidth="1" />
      </svg>

      <span className="spine-text">Multi-Provider Usage Telemetry</span>

      <div className="tick-rail h-24 w-2" />
    </aside>
  );
}
