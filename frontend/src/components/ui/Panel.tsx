import React from "react";
import { useSpotlight } from "../../hooks/useSpotlight";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
}

/**
 * Surface used for every block of content. `interactive` adds the lift and
 * the pointer-following spotlight defined in the design system.
 */
export function Panel({
  interactive = false,
  padded = true,
  className = "",
  children,
  ...rest
}: PanelProps) {
  const spot = useSpotlight<HTMLDivElement>();

  if (!interactive) {
    return (
      <div className={`panel ${padded ? "p-5" : ""} ${className}`} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={spot.ref}
      onPointerMove={spot.onPointerMove}
      onPointerLeave={spot.onPointerLeave}
      className={`panel panel-interactive ${padded ? "p-5" : ""} ${className}`}
      {...rest}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
