import React, { useState } from "react";
import {
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  HelpCircle,
  Layers,
  Lightbulb,
  List,
  Maximize2,
  Minimize2,
  Star,
  Target,
  Zap,
} from "lucide-react";
import { DocumentItem } from "./api";

/* ─── Section colour palette ─── */
const SECTION_COLORS = [
  { bg: "from-indigo-900/60 to-indigo-950/80", border: "border-indigo-700/60", badge: "bg-indigo-600", icon: "text-indigo-300" },
  { bg: "from-violet-900/60 to-violet-950/80", border: "border-violet-700/60", badge: "bg-violet-600", icon: "text-violet-300" },
  { bg: "from-cyan-900/60 to-cyan-950/80",     border: "border-cyan-700/60",   badge: "bg-cyan-600",   icon: "text-cyan-300" },
  { bg: "from-emerald-900/60 to-emerald-950/80", border: "border-emerald-700/60", badge: "bg-emerald-600", icon: "text-emerald-300" },
  { bg: "from-amber-900/60 to-amber-950/80",   border: "border-amber-700/60",  badge: "bg-amber-600",  icon: "text-amber-300" },
  { bg: "from-rose-900/60 to-rose-950/80",     border: "border-rose-700/60",   badge: "bg-rose-600",   icon: "text-rose-300" },
  { bg: "from-sky-900/60 to-sky-950/80",       border: "border-sky-700/60",    badge: "bg-sky-600",    icon: "text-sky-300" },
  { bg: "from-teal-900/60 to-teal-950/80",     border: "border-teal-700/60",   badge: "bg-teal-600",   icon: "text-teal-300" },
];

/* ─── Section icons by keyword ─── */
function getSectionIcon(title: string, colorClass: string) {
  const t = title.toLowerCase();
  if (t.includes("intro") || t.includes("preface") || t.includes("overview"))
    return <Lightbulb className={`w-5 h-5 ${colorClass}`} />;
  if (t.includes("contents") || t.includes("table") || t.includes("index"))
    return <List className={`w-5 h-5 ${colorClass}`} />;
  if (t.includes("chapter") || t.includes("section"))
    return <Layers className={`w-5 h-5 ${colorClass}`} />;
  if (t.includes("install") || t.includes("setup") || t.includes("start"))
    return <Zap className={`w-5 h-5 ${colorClass}`} />;
  if (t.includes("practice") || t.includes("exercise") || t.includes("quiz"))
    return <Target className={`w-5 h-5 ${colorClass}`} />;
  if (t.includes("conclusion") || t.includes("summary") || t.includes("final"))
    return <Star className={`w-5 h-5 ${colorClass}`} />;
  return <BookOpen className={`w-5 h-5 ${colorClass}`} />;
}

/* ─── Clean up raw dump text into proper sentences / bullets ─── */
function formatSummaryText(raw: string): string[] {
  if (!raw) return [];
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/* Render each source-grounded summary paragraph as written. */
function ContentLine({ line, colorClass }: { line: string; colorClass: string }) {
  if (line.startsWith("__HEADING__")) {
    return (
      <div className={`font-semibold text-sm mt-3 mb-1 ${colorClass}`}>
        {line.slice(11)}
      </div>
    );
  }
  if (line.startsWith("__BULLET__")) {
    return (
      <div className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
        <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${colorClass.replace("text-", "bg-")}`} />
        <span>{line.slice(10)}</span>
      </div>
    );
  }
  return <p className="text-sm text-slate-300 leading-relaxed">{line}</p>;
}

/* ─── Single expandable section card ─── */
function SectionCard({
  section,
  index,
  total,
}: {
  section: { title: string; pages: number[]; summary: string };
  index: number;
  total: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const color = SECTION_COLORS[index % SECTION_COLORS.length];
  const lines = formatSummaryText(section.summary);
  const pageLabel = section.pages.length === 1
    ? `Page ${section.pages[0]}`
    : `Pages ${section.pages[0]}–${section.pages[section.pages.length - 1]}`;

  return (
    <div
      className={`surface-hover rounded-2xl border bg-gradient-to-br ${color.bg} ${color.border} transition-all duration-300 ${
        fullscreen ? "fixed inset-4 z-50 overflow-y-auto shadow-2xl" : ""
      }`}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => !fullscreen && setExpanded((e) => !e)}
      >
        {/* Step bubble */}
        <div className={`w-9 h-9 rounded-full ${color.badge} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
          {index + 1}
        </div>

        {getSectionIcon(section.title, color.icon)}

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm leading-tight truncate">
            {section.title}
          </div>
          <div className={`text-xs mt-0.5 ${color.icon} opacity-80`}>{pageLabel}</div>
        </div>

        {/* Progress bar mini */}
        <div className="hidden sm:flex items-center gap-2 mr-2">
          <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${color.badge}`}
              style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-400">{Math.round(((index + 1) / total) * 100)}%</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(ev) => { ev.stopPropagation(); setFullscreen((f) => !f); }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
            title={fullscreen ? "Exit fullscreen" : "Expand"}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {!fullscreen && (
            <div className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}>
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Card body */}
      {(expanded || fullscreen) && (
        <div className="px-4 pb-5 space-y-1.5 border-t border-white/10 pt-3">
          {lines.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No content extracted for this section.</p>
          ) : (
            lines.map((line, li) => (
              <ContentLine key={li} line={line} colorClass={color.icon} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Table of Contents flow diagram ─── */
function TocDiagram({ sections }: { sections: { title: string; pages: number[] }[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="surface-hover rounded-2xl bg-slate-900/80 border border-slate-700/60 p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-indigo-400" />
        <h4 className="text-sm font-semibold text-white">Document Structure</h4>
        <span className="ml-auto text-xs text-slate-500">{sections.length} sections</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sections.map((s, i) => {
          const color = SECTION_COLORS[i % SECTION_COLORS.length];
          return (
            <React.Fragment key={i}>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${color.border} ${color.icon} bg-slate-950/60`}
              >
                <span className={`w-4 h-4 rounded-full ${color.badge} flex items-center justify-center text-[10px] text-white font-bold`}>
                  {i + 1}
                </span>
                <span className="max-w-[120px] truncate">{s.title}</span>
              </div>
              {i < sections.length - 1 && (
                <div className="flex items-center text-slate-600">
                  <ChevronRight className="w-3 h-3" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Reading progress bar */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-[11px] text-slate-400 shrink-0">Total coverage</span>
        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden flex">
          {sections.map((_, i) => {
            const color = SECTION_COLORS[i % SECTION_COLORS.length];
            return (
              <div
                key={i}
                title={sections[i].title}
                className={`h-full ${color.badge} transition-all duration-500`}
                style={{ width: `${100 / sections.length}%` }}
              />
            );
          })}
        </div>
        <span className="text-[11px] text-slate-400 shrink-0">100%</span>
      </div>
    </div>
  );
}

/* ─── Quiz card ─── */
function QuizCard({
  item,
  index,
  revealed,
  onReveal,
}: {
  item: any;
  index: number;
  revealed: boolean;
  onReveal: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    mcq:         { label: "Multiple Choice", color: "text-indigo-300 bg-indigo-900/40 border-indigo-700/50", icon: <Brain className="w-3.5 h-3.5" /> },
    true_false:  { label: "True / False",    color: "text-cyan-300 bg-cyan-900/40 border-cyan-700/50",       icon: <HelpCircle className="w-3.5 h-3.5" /> },
    flashcard:   { label: "Flashcard",       color: "text-emerald-300 bg-emerald-900/40 border-emerald-700/50", icon: <Zap className="w-3.5 h-3.5" /> },
    short_answer:{ label: "Short Answer",    color: "text-amber-300 bg-amber-900/40 border-amber-700/50",    icon: <Lightbulb className="w-3.5 h-3.5" /> },
  };
  const cfg = typeConfig[item.type] ?? typeConfig.short_answer;

  return (
    <div className="surface-hover rounded-2xl border border-slate-700/50 bg-slate-900 overflow-hidden">
      {/* Header strip */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/50`}>
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${cfg.color}`}>
          {cfg.icon} {cfg.label}
        </span>
        <span className="ml-auto text-xs text-slate-500">Q{index + 1} · Page {item.page_number}</span>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-sm font-medium text-white">{item.question}</p>

        {/* Options (MCQ / True-False) */}
        {item.options?.length > 0 && (
          <div className="space-y-2">
            {item.options.map((opt: string, oi: number) => {
              const isCorrect = revealed && opt === item.answer;
              const isWrong   = revealed && selected === oi && opt !== item.answer;
              return (
                <button
                  key={oi}
                  onClick={() => { if (!revealed) setSelected(oi); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm border transition-all ${
                    isCorrect
                      ? "bg-emerald-900/40 border-emerald-500 text-emerald-200"
                      : isWrong
                      ? "bg-rose-900/40 border-rose-500 text-rose-300"
                      : selected === oi
                      ? "bg-indigo-900/40 border-indigo-500 text-white"
                      : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                  }`}
                >
                  <span className="font-mono text-xs mr-2 opacity-50">
                    {String.fromCharCode(65 + oi)}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* Reveal button */}
        <button
          onClick={onReveal}
          className={`w-full py-2 rounded-xl text-xs font-medium border transition-all ${
            revealed
              ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-indigo-300"
          }`}
        >
          {revealed ? "✓ Answer Shown" : "Reveal Answer & Source"}
        </button>

        {/* Answer reveal */}
        {revealed && (
          <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <Star className="w-3.5 h-3.5" /> Correct Answer
            </div>
            <p className="text-sm text-white">{item.answer}</p>
            <div className="pt-1 border-t border-emerald-800/40">
              <p className="text-[11px] text-emerald-400/80 italic leading-relaxed">{item.evidence}</p>
              <span className="inline-block mt-1 text-[11px] text-indigo-400">📄 Source: Page {item.page_number}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main StudyMode component ─── */
interface StudyModeProps {
  documents: DocumentItem[];
  studyDocId: string;
  setStudyDocId: (id: string) => void;
  summaryType: string;
  setSummaryType: (t: string) => void;
  summaryResult: any;
  quizResult: any;
  revealedIdx: Record<number, boolean>;
  setRevealedIdx: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  studyLoading: boolean;
  studyError: string;
  onSummary: () => void;
  onQuiz: () => void;
}

export function StudyMode({
  documents,
  studyDocId,
  setStudyDocId,
  summaryType,
  setSummaryType,
  summaryResult,
  quizResult,
  revealedIdx,
  setRevealedIdx,
  studyLoading,
  studyError,
  onSummary,
  onQuiz,
}: StudyModeProps) {
  const readyDocs = documents.filter((d) => d.status === "completed");
  const selectedDoc = readyDocs.find((d) => d.id === studyDocId) ?? readyDocs[0];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">AI Study Mode</h2>
          <p className="text-sm text-slate-400">Generate smart summaries and quiz yourself on any document</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="surface-hover p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap gap-3 items-center">
        {readyDocs.length === 0 ? (
          <p className="text-sm text-slate-400">Upload and index a PDF first.</p>
        ) : (
          <>
            <select
              value={studyDocId || selectedDoc?.id || ""}
              onChange={(e) => setStudyDocId(e.target.value)}
              className="flex-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {readyDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  📄 {d.filename} ({d.page_count}p · {d.chunk_count} chunks)
                </option>
              ))}
            </select>

            <select
              value={summaryType}
              onChange={(e) => setSummaryType(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="short">⚡ Quick Overview</option>
              <option value="detailed">📖 Detailed Summary</option>
              <option value="section_by_section">🗂️ Section-by-Section</option>
            </select>

            <button
              onClick={onSummary}
              disabled={studyLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white disabled:opacity-50 transition"
            >
              <Layers className="w-4 h-4" />
              {studyLoading ? "Generating…" : "Summarize"}
            </button>

            <button
              onClick={onQuiz}
              disabled={studyLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white disabled:opacity-50 transition"
            >
              <Brain className="w-4 h-4" />
              {studyLoading ? "Generating…" : "Quiz Me"}
            </button>
          </>
        )}
      </div>

      {/* Loading skeleton */}
      {studyLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 animate-pulse space-y-2">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-800 rounded w-5/6" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {studyError && !studyLoading && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-sm text-rose-300">
          ⚠️ {studyError}
        </div>
      )}

      {/* ── Summary result ── */}
      {summaryResult && !studyLoading && (
        <div className="space-y-4">
          {/* Meta bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-white font-semibold">
              <FileText className="w-4 h-4 text-indigo-400" />
              {summaryResult.filename}
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs">
              {summaryResult.summary_type === "short"
                ? "⚡ Quick Overview"
                : summaryResult.summary_type === "detailed"
                ? "📖 Detailed Summary"
                : "🗂️ Section-by-Section"}
            </span>
            <span className="text-xs text-slate-400 ml-auto">
              {summaryResult.sections.length} section{summaryResult.sections.length !== 1 ? "s" : ""}
            </span>
          </div>

          {summaryResult.summary_method !== "llm" && (
            <p className="text-xs text-amber-300/90">
              {summaryResult.summary_method === "extractive"
                ? "Showing key source sentences. Configure LLM_API_KEY in the backend for synthesized summaries."
                : "Some sections use selected source sentences because the language model was unavailable."}
            </p>
          )}

          {/* TOC diagram */}
          <TocDiagram sections={summaryResult.sections} />

          {/* Section cards */}
          <div className="space-y-3">
            {summaryResult.sections.map((s: any, i: number) => (
              <SectionCard
                key={i}
                section={s}
                index={i}
                total={summaryResult.sections.length}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Quiz result ── */}
      {quizResult && !studyLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Interactive Quiz</h3>
              <p className="text-xs text-slate-400">{quizResult.filename} · {quizResult.items.length} questions</p>
            </div>
            {/* Reveal all */}
            <button
              onClick={() => {
                const all: Record<number, boolean> = {};
                quizResult.items.forEach((_: any, i: number) => { all[i] = true; });
                setRevealedIdx(all);
              }}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-indigo-300"
            >
              Reveal All Answers
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizResult.items.map((item: any, i: number) => (
              <QuizCard
                key={i}
                item={item}
                index={i}
                revealed={!!revealedIdx[i]}
                onReveal={() => setRevealedIdx((p) => ({ ...p, [i]: !p[i] }))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
