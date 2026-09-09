// Specs from odoo_dashboards_saas/REDESIGN.md Part 2.6 -- height 40 default /
// 32 compact, radius 6, weight 500, imperative sentence-case labels
// ("Create dashboard", never "Submit"/"OK").
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-[hsl(220_9%_65%)]",
  {
    variants: {
      variant: {
        primary: "bg-primary-500 text-white hover:bg-primary-700",
        secondary:
          "bg-white text-[hsl(220_9%_20%)] border border-[hsl(220_13%_88%)] hover:bg-muted",
        ghost: "bg-transparent text-primary-700 hover:bg-primary-50",
        outline:
          "bg-white text-[hsl(244_100%_45%)] border border-[hsl(244_60%_80%)] hover:bg-primary-50",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        default: "h-10 px-4",
        compact: "h-8 px-3 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
