import React, { useCallback, useRef } from "react";

type Variant = "primary" | "ghost" | "gold" | "danger";
type Size = "md" | "sm";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconOnly?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  gold: "btn-gold",
  danger: "btn-danger",
};

/**
 * Button with an ink-ripple on press and a sheen sweep on hover. The ripple
 * span is injected straight into the DOM so a press never re-renders React.
 */
export function Button({
  variant = "ghost",
  size = "md",
  iconOnly = false,
  loading = false,
  icon,
  trailing,
  className = "",
  children,
  onPointerDown,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const hostRef = useRef<HTMLButtonElement | null>(null);

  const spawnRipple = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const drop = document.createElement("span");
    drop.className = "ripple-drop";
    drop.style.left = `${event.clientX - rect.left - 9}px`;
    drop.style.top = `${event.clientY - rect.top - 9}px`;
    host.appendChild(drop);
    window.setTimeout(() => drop.remove(), 700);
  }, []);

  const classes = [
    "btn",
    VARIANT_CLASS[variant],
    size === "sm" ? "btn-sm" : "",
    iconOnly ? "btn-icon" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={hostRef}
      type={type}
      className={classes}
      disabled={disabled || loading}
      onPointerDown={(event) => {
        if (!disabled && !loading) spawnRipple(event);
        onPointerDown?.(event);
      }}
      {...rest}
    >
      <span className="relative z-[2] flex items-center gap-2">
        {loading ? <span className="spinner" /> : icon}
        {children}
        {!loading && trailing}
      </span>
    </button>
  );
}
