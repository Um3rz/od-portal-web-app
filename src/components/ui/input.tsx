// REDESIGN.md Part 2.6 -- height 40 (38 in dense builder chrome), radius 6,
// 1px hsl(220 13% 88%) border. Focus ring REPLACES the border (see
// .o_dsaas :focus-visible in globals.css), never stacks on it.
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border bg-white px-3 text-sm text-foreground placeholder:text-fg-subtle outline-none transition-shadow",
        error
          ? "border-danger text-[hsl(0_70%_45%)]"
          : "border-[hsl(220_13%_88%)]",
        className,
      )}
      {...props}
    />
  );
}
