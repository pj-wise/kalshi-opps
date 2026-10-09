"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Lightweight explainer that shows on hover/focus.  Deliberately uses a
// native <title> attribute as a baseline (always works) plus a styled popup so
// the hover feels nicer when you can see it.
export function InfoHint({ children, className }: { children: React.ReactNode; className?: string }) {
  const text = typeof children === "string" ? children : "";
  return (
    <span className={cn("group relative inline-flex", className)}>
      <Info
        className="h-3 w-3 text-zinc-500 group-hover:text-emerald-400 group-focus:text-emerald-400"
        aria-hidden
      />
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-60 -translate-x-1/2 scale-95 rounded-md border border-zinc-800 bg-zinc-950 p-2 text-[11px] font-normal normal-case tracking-normal text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
