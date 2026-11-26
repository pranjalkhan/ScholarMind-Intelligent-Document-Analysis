import React from "react";

interface StatusPillProps {
  status: string;
}

export function StatusPill({ status }: StatusPillProps) {
  const normalized = status.toLowerCase();

  const style =
    normalized === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : normalized === "failed"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
        : normalized === "pending"
          ? "border-slate-600/60 bg-slate-700/40 text-slate-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style}`}
    >
      {normalized}
    </span>
  );
}
