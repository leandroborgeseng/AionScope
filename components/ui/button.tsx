import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aion-blue/35",
  {
    variants: {
      variant: {
        default: "bg-aion-blue text-white hover:bg-aion-deep",
        secondary: "bg-aion-mist text-aion-ink hover:bg-aion-line/70",
        outline: "border border-aion-line bg-white text-aion-ink hover:border-aion-blue/40 hover:bg-aion-mist",
        ghost: "text-aion-ink hover:bg-aion-mist hover:text-aion-blue",
        danger: "bg-rose-600 text-white hover:bg-rose-700",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-10 px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
