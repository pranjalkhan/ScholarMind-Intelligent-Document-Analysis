import React from "react";

interface BenchmarkBarsProps {
  run: Record<string, any>;
}

const METRICS: { key: string; label: string }[] = [
  { key: "recall_at_5", label: "Recall@5" },
  { key: "precision_at_5", label: "Precision@5" },
  { key: "mrr", label: "MRR" },
  { key: "faithfulness", label: "Faithfulness" },
  { key: "citation_precision", label: "Citation precision" },
  { key: "abstention_accuracy", label: "Abstention accuracy" },
];

/** Converts a 0–1 ratio (or an already-scaled percentage) into 0–100. */
export function toPercent(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num <= 1 ? num * 100 : num));
}

function barColour(percent: number): string {
  if (percent >= 75) return "linear-gradient(90deg,#34d399,#2dd4bf)";
  if (percent >= 50) return "linear-gradient(90deg,#f0b429,#34d399)";
  return "linear-gradient(90deg,#fb7185,#f0b429)";
}

/** Animated metric bars for one benchmark run. */
export function BenchmarkBars({ run }: BenchmarkBarsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="mono-num text-xs text-slate-300">{run.version_name}</span>
        <span className="mono-num text-[10px] text-slate-500">
          {run.total_questions ?? 0} questions
        </span>
      </div>
      {METRICS.map((metric, index) => {
        const percent = toPercent(run[metric.key]);
        return (
          <div
            key={metric.key}
            className="animate-fade-up space-y-1"
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{metric.label}</span>
              <span className="mono-num text-slate-300">{percent.toFixed(1)}%</span>
            </div>
            <div className="track">
              <span style={{ width: `${percent}%`, background: barColour(percent) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
