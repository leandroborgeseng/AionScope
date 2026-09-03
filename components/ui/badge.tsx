import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        default: "bg-slate-100 text-slate-700",
        ok: "bg-emerald-50 text-emerald-800",
        warn: "bg-amber-50 text-amber-800",
        danger: "bg-rose-50 text-rose-800",
        info: "bg-teal-50 text-teal-800",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
