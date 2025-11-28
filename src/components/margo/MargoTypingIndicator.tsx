import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type MargoTypingIndicatorProps = HTMLAttributes<HTMLSpanElement>;

export const MargoTypingIndicator = ({ className, ...props }: MargoTypingIndicatorProps) => {
  return (
    <span className={cn("margo-typing-indicator text-current/80", className)} aria-live="polite" {...props}>
      <span className="margo-typing-dot" />
      <span className="margo-typing-dot" />
      <span className="margo-typing-dot" />
    </span>
  );
};

export default MargoTypingIndicator;

