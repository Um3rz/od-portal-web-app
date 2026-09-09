// `spinner` (33 uses in the addon) is not an icon -- replace with a CSS
// bordered-circle keyframe animation, not a drawn glyph (REDESIGN.md Part 3.1).
import { cn } from "@/lib/utils";

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-primary-500", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
