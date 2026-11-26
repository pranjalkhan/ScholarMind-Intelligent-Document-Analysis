import React from "react";

interface SkeletonProps {
  className?: string;
}

/** Shimmering placeholder block used while evidence is being retrieved. */
export function Skeleton({ className = "h-3 w-full" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** A stack of skeleton lines with a ragged last line. */
export function SkeletonLines({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-3 ${index === lines - 1 ? "w-2/5" : index % 2 === 0 ? "w-full" : "w-11/12"}`}
        />
      ))}
    </div>
  );
}

/** Table-shaped skeleton for the comparison and evaluation grids. */
export function SkeletonTable({ rows = 4, columns = 3 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3 p-4" aria-label="Loading results">
      <div className="flex gap-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3" style={{ opacity: 1 - rowIndex * 0.13 }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-14 flex-1 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Three bouncing dots used as a thinking indicator. */
export function TypingDots({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[color:var(--color-accent)]">
      <span className="inline-flex items-end gap-1">
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: "0.16s" }} />
        <span className="typing-dot" style={{ animationDelay: "0.32s" }} />
      </span>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </span>
  );
}
