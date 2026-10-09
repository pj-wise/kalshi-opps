import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Activity, BarChart3, Bell, Eye, LineChart, Settings as SettingsIcon } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "betgg — prediction market terminal",
  description: "Personal prediction-market analytics dashboard",
};

const NAV = [
  { href: "/", label: "Markets", icon: Activity },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/performance", label: "Track record", icon: LineChart },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-200">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <span>betgg</span>
            <span className="text-[11px] text-zinc-500">personal market dashboard</span>
          </Link>
          <nav className="flex items-center gap-1 text-xs">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
