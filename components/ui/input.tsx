import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-aion-line bg-white px-3 text-sm text-aion-ink placeholder:text-aion-muted focus:border-aion-blue focus:outline-none focus:ring-2 focus:ring-aion-blue/20",
        className,
      )}
      {...props}
    />
  );
}
