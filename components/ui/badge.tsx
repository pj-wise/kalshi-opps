import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
        outline: "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200",
        positive: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        negative: "bg-red-500/15 text-red-700 dark:text-red-300",
        warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
