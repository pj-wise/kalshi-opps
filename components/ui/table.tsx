import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cn("w-full caption-bottom text-xs", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-zinc-950/95 [&_th]:border-b [&_th]:border-zinc-200 dark:[&_th]:border-zinc-800",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-zinc-100 transition-colors hover:bg-zinc-50 data-[state=selected]:bg-zinc-100 dark:border-zinc-900 dark:hover:bg-zinc-900/50",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-8 px-2 text-left align-middle text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-2 py-1.5 align-middle text-zinc-900 dark:text-zinc-100 [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}
