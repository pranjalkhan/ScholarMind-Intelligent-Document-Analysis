export type TabId = "dashboard" | "library" | "chat" | "compare" | "study" | "evaluation";

export interface NavItem {
  id: TabId;
  label: string;
  hint: string;
  short: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", hint: "Workspace overview", short: "Overview" },
  { id: "library", label: "Documents", hint: "Upload and index PDFs", short: "Library" },
  { id: "chat", label: "AI Chat", hint: "Ask with claim-level citations", short: "Ask" },
  { id: "compare", label: "Compare Papers", hint: "Side-by-side evidence grid", short: "Compare" },
  { id: "study", label: "Study Mode", hint: "Summaries and quizzes", short: "Study" },
  { id: "evaluation", label: "Evaluation", hint: "RAG benchmark results", short: "Bench" },
];
