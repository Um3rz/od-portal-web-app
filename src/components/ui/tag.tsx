// REDESIGN.md Part 2.6 -- Tag vs. lozenge is a real distinction to preserve:
// Tag = classification, decorative, outline only, no fill, no meaning
// ("Bar chart"). Lozenge = status, semantic, tinted fill + 1px border + 6px
// leading dot (Published / Draft / Error).
import * as React from "react";
import { cn } from "@/lib/utils";

export function Tag({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-border px-2 py-0.5 text-xs font-medium text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

type LozengeTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<LozengeTone, string> = {
  success: "bg-[hsl(152_60%_95%)] border-[hsl(152_60%_75%)] text-success",
  warning: "bg-[hsl(43_74%_95%)] border-[hsl(43_74%_75%)] text-[hsl(43_74%_35%)]",
  danger: "bg-[hsl(0_84%_96%)] border-[hsl(0_84%_85%)] text-danger",
  info: "bg-[hsl(217_91%_96%)] border-[hsl(217_91%_85%)] text-info",
  neutral: "bg-muted border-border text-fg-muted",
};

export interface LozengeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: LozengeTone;
}

export function Lozenge({ tone = "neutral", className, children, ...props }: LozengeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
