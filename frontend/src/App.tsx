import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileText,
  GitCompare,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  ExternalLink,
} from "lucide-react";
import { api, ChatResponse, DocumentItem, getToken, setToken, User } from "./api";
import { StudyMode } from "./StudyMode";

type Tab = "dashboard" | "library" | "chat" | "compare" | "study" | "evaluation";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("chat");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [conversations, setConversations] = useState<{ id: string; title: string }[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // Chat state
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<"auto" | "en" | "bn">("auto");
  const [useReranker, setUseReranker] = useState(true);
  const [useQueryRewrite, setUseQueryRewrite] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "assistant";
      content: string;
      response?: ChatResponse;
    }>
  >([]);
  const [activeCitation, setActiveCitation] = useState<{
    filename: string;
    page_number: number;
    quote: string;
    document_id: string;
  } | null>(null);

  // Compare state
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareTopic, setCompareTopic] = useState("methodology, dataset, results, and limitations");
  const [compareResult, setCompareResult] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Study state
  const [studyDocId, setStudyDocId] = useState("");
  const [summaryType, setSummaryType] = useState("short");
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [revealedIdx, setRevealedIdx] = useState<Record<number, boolean>>({});
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState("");

  // Evaluation state
  const [evalData, setEvalData] = useState<{ runs: any[]; failure_examples: any[] }>({
    runs: [],
    failure_examples: [],
  });
  const [evalRunning, setEvalRunning] = useState(false);

  useEffect(() => {
    if (getToken()) {
      api
        .me()
        .then((u) => {
          setUser(u);
          refreshData();
        })
        .catch(() => setToken(null));
    }
  }, []);

  async function refreshData() {
    try {
      const [docs, convs, ev] = await Promise.all([
        api.listDocuments(),
        api.listConversations(),
        api.getEvaluationSummary(),
      ]);
      setDocuments(docs);
      setConversations(convs);
      setEvalData(ev);
      if (docs.length > 0 && !studyDocId) setStudyDocId(docs[0].id);
    } catch {
      // ignore
    }
  }

  // Poll pending documents
  useEffect(() => {
    const hasPending = documents.some((d) => !["completed", "failed"].includes(d.status));
    if (!hasPending) return;
    const timer = setInterval(refreshData, 2000);
    return () => clearInterval(timer);
  }, [documents]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    try {
      const res =
        authMode === "register"
          ? await api.register(email, password, fullName)
          : await api.login(email, password);
      setToken(res.access_token);
      setUser(res.user);
      refreshData();
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setDocuments([]);
    setMessages([]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.uploadDocument(file);
      await refreshData();
    } catch (err: any) {
      alert(err.message);
    }
    e.target.value = "";
  }

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || chatLoading) return;
    const q = question.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setChatLoading(true);
    try {
      const res = await api.chat({
        question: q,
        conversation_id: activeConvId,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
        language,
        use_reranker: useReranker,
        use_query_rewrite: useQueryRewrite,
      });
      setActiveConvId(res.conversation_id);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer, response: res }]);
      refreshData();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleCompare() {
    if (compareIds.length < 2) return alert("Select at least 2 documents.");
    setCompareLoading(true);
    try {
      const res = await api.comparePapers(compareIds, compareTopic);
      setCompareResult(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCompareLoading(false);
    }
  }

  async function handleSummary() {
    const targetId = studyDocId || documents[0]?.id;
    if (!targetId) {
      setStudyError("Please upload a PDF document first.");
      return;
    }
    setStudyError("");
    setStudyLoading(true);
    try {
      const res = await api.generateSummary(targetId, summaryType);
      setSummaryResult(res);
    } catch (err: any) {
      setStudyError(err.message || "Failed to generate summary.");
    } finally {
      setStudyLoading(false);
    }
  }

  async function handleQuiz() {
    const targetId = studyDocId || documents[0]?.id;
    if (!targetId) {
      setStudyError("Please upload a PDF document first.");
      return;
    }
    setStudyError("");
    setStudyLoading(true);
    try {
      const res = await api.generateQuiz(targetId, 5);
      setQuizResult(res);
      setRevealedIdx({});
    } catch (err: any) {
      setStudyError(err.message || "Failed to generate quiz.");
    } finally {
      setStudyLoading(false);
    }
  }

  async function handleRunEval() {
    setEvalRunning(true);
    try {
      await api.runEvaluation(["V1", "V2", "V3", "V4", "V5"]);
      await refreshData();
    } finally {
      setEvalRunning(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="surface-hover w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">ScholarMind</h1>
              <p className="text-xs text-slate-400">Intelligent Document Analysis</p>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === "register" && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Researcher Name"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
            {authError && <p className="text-xs text-rose-400">{authError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-sm transition"
            >
              {authMode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <button
            onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
            className="mt-4 w-full text-xs text-slate-400 hover:text-indigo-400"
          >
            {authMode === "login"
              ? "Need an account? Register"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "library", label: "Documents", icon: <FileText className="w-4 h-4" /> },
    { id: "chat", label: "AI Chat", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "compare", label: "Compare Papers", icon: <GitCompare className="w-4 h-4" /> },
    { id: "study", label: "Study Mode", icon: <BookOpen className="w-4 h-4" /> },
    { id: "evaluation", label: "Evaluation", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col p-4">
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm">ScholarMind</div>
            <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{user.email}</div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                tab === item.id
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {tab === "dashboard" && (
          <div className="max-w-5xl space-y-6">
            <h2 className="text-2xl font-bold">Research Workspace</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="surface-hover p-5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">Indexed Documents</div>
                <div className="text-3xl font-bold mt-1">{documents.length}</div>
              </div>
              <div className="surface-hover p-5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">Conversations</div>
                <div className="text-3xl font-bold mt-1">{conversations.length}</div>
              </div>
              <div className="surface-hover p-5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">Eval Runs</div>
                <div className="text-3xl font-bold mt-1">{evalData.runs.length}</div>
              </div>
            </div>
            <div className="surface-hover p-5 rounded-xl bg-slate-900 border border-slate-800">
              <h3 className="font-semibold mb-3">Recent Documents</h3>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-400">Upload a PDF in the Documents tab to begin.</p>
              ) : (
                <div className="space-y-2">
                  {documents.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex justify-between text-sm py-1.5 border-b border-slate-800 last:border-0">
                      <span>{d.filename}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                        {d.status} • {d.page_count}p
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "library" && (
          <div className="max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Document Library</h2>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium">
                <Upload className="w-4 h-4" /> Upload PDF
                <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
              </label>
            </div>

            <div className="grid gap-3">
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="surface-hover p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">{d.filename}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Status: <span className="text-indigo-300">{d.status}</span> • {d.page_count} pages •{" "}
                      {d.chunk_count} chunks {d.ocr_pages > 0 ? `• ${d.ocr_pages} OCR pages` : ""}
                    </div>
                    {d.error_message && (
                      <div className="text-xs text-rose-400 mt-1">{d.error_message}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status === "failed" && (
                      <button
                        onClick={() => api.retryDocument(d.id).then(refreshData)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                        title="Retry processing"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => api.deleteDocument(d.id).then(refreshData)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "chat" && (
          <div className="flex gap-5 h-[calc(100vh-3rem)]">
            <div className="flex-1 flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              {/* Top Controls */}
              <div className="p-3 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-slate-400">Scope:</span>
                {documents.filter((d) => d.status === "completed").map((d) => {
                  const active = selectedDocIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() =>
                        setSelectedDocIds((prev) =>
                          active ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full border ${
                        active
                          ? "bg-indigo-600/30 border-indigo-500 text-indigo-200"
                          : "border-slate-700 text-slate-400"
                      }`}
                    >
                      {d.filename}
                    </button>
                  );
                })}
                <div className="ml-auto flex items-center gap-3">
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1"
                  >
                    <option value="auto">Auto (EN/BN)</option>
                    <option value="en">English</option>
                    <option value="bn">বাংলা (Bangla)</option>
                  </select>
                  <label className="flex items-center gap-1 text-slate-300">
                    <input
                      type="checkbox"
                      checked={useReranker}
                      onChange={(e) => setUseReranker(e.target.checked)}
                    />
                    Reranker
                  </label>
                  <label className="flex items-center gap-1 text-slate-300">
                    <input
                      type="checkbox"
                      checked={useQueryRewrite}
                      onChange={(e) => setUseQueryRewrite(e.target.checked)}
                    />
                    Rewrite
                  </label>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-slate-500 mt-16 text-sm">
                    Ask a question in English or বাংলা. ScholarMind verifies every claim against your PDFs.
                  </div>
                )}
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl max-w-3xl ${
                      m.role === "user"
                        ? "ml-auto bg-indigo-600/20 border border-indigo-500/30"
                        : "bg-slate-900 border border-slate-800"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>

                    {m.response && (
                      <div className="mt-3 space-y-2">
                        {m.response.insufficient_evidence && (
                          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2.5">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            Abstained: Insufficient evidence in selected documents.
                          </div>
                        )}

                        {m.response.conflicts.length > 0 && (
                          <div className="text-xs text-rose-200 bg-rose-950/40 border border-rose-800/50 rounded-lg p-2.5 space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold">
                              <AlertTriangle className="w-4 h-4" /> Conflicting Sources Detected
                            </div>
                            {m.response.conflicts.map((cf, i) => (
                              <div key={i}>
                                <strong>{cf.source_a}:</strong> {cf.statement_a} <br />
                                <strong>{cf.source_b}:</strong> {cf.statement_b}
                              </div>
                            ))}
                          </div>
                        )}

                        {m.response.claims.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-800">
                            <div className="text-[11px] uppercase tracking-wider text-slate-400">
                              Claim-Level Citations
                            </div>
                            {m.response.claims.map((cl, ci) => (
                              <div key={ci} className="text-xs bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                                <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{cl.verification_status}</span>
                                </div>
                                <p className="text-slate-200 mb-1.5">{cl.claim_text}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {cl.citations.map((cit, cii) => (
                                    <button
                                      key={cii}
                                      onClick={() => setActiveCitation(cit)}
                                      className="px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-[11px]"
                                    >
                                      {cit.filename} • p.{cit.page_number}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>
                            {m.response.latency_ms} ms • \${m.response.estimated_cost_usd.toFixed(5)}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => api.sendFeedback(m.response!.message_id, "helpful")}
                              className="hover:text-emerald-400"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => api.sendFeedback(m.response!.message_id, "not_helpful")}
                              className="hover:text-rose-400"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && <div className="text-xs text-slate-400">Retrieving & verifying evidence...</div>}
              </div>

              {/* Input */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-slate-800 flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about your documents..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" /> Ask
                </button>
              </form>
            </div>

            {/* Source Passage Inspector */}
            {activeCitation && (
              <div className="w-80 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-sm">Source Passage</h3>
                  <button
                    onClick={() => setActiveCitation(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="text-xs text-indigo-300 mb-2 flex items-center justify-between">
                  <span>
                    {activeCitation.filename} • Page {activeCitation.page_number}
                  </span>
                  <button
                    onClick={() =>
                      api
                        .openDocumentAtPage(activeCitation.document_id, activeCitation.page_number)
                        .catch((err) => alert(err.message))
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" /> Open PDF
                  </button>
                </div>
                <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed flex-1 overflow-y-auto">
                  "{activeCitation.quote}"
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "compare" && (
          <div className="max-w-5xl space-y-5">
            <h2 className="text-2xl font-bold">Multi-Document Research Comparison</h2>
            <div className="surface-hover p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex flex-wrap gap-2">
                {documents.map((d) => {
                  const sel = compareIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() =>
                        setCompareIds((prev) =>
                          sel ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs border ${
                        sel ? "bg-indigo-600 border-indigo-500" : "border-slate-700 text-slate-300"
                      }`}
                    >
                      {d.filename}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={compareTopic}
                  onChange={(e) => setCompareTopic(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  placeholder="Comparison focus..."
                />
                <button
                  onClick={handleCompare}
                  disabled={compareLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
                >
                  {compareLoading ? "Comparing..." : "Compare Papers"}
                </button>
              </div>
            </div>

            {compareResult && (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm text-left bg-slate-900">
                  <thead className="bg-slate-800/80 text-xs uppercase text-slate-300">
                    <tr>
                      <th className="p-3">Dimension</th>
                      {compareResult.documents.map((d: any) => (
                        <th key={d.id} className="p-3">{d.filename}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareResult.rows.map((r: any, i: number) => (
                      <tr key={i} className="border-t border-slate-800 align-top">
                        <td className="p-3 font-medium text-indigo-300">{r.aspect}</td>
                        {compareResult.documents.map((d: any) => {
                          const cell = r.cells[d.id] || {};
                          return (
                            <td key={d.id} className="p-3 text-xs text-slate-300">
                              <p>{cell.summary}</p>
                              {cell.page && (
                                <span className="inline-block mt-1 text-[11px] text-indigo-400">
                                  Page {cell.page}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "study" && (
          <StudyMode
            documents={documents}
            studyDocId={studyDocId}
            setStudyDocId={setStudyDocId}
            summaryType={summaryType}
            setSummaryType={setSummaryType}
            summaryResult={summaryResult}
            quizResult={quizResult}
            revealedIdx={revealedIdx}
            setRevealedIdx={setRevealedIdx}
            studyLoading={studyLoading}
            studyError={studyError}
            onSummary={handleSummary}
            onQuiz={handleQuiz}
          />
        )}

        {tab === "evaluation" && (
          <div className="max-w-5xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">RAG Evaluation Dashboard</h2>
              <button
                onClick={handleRunEval}
                disabled={evalRunning}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
              >
                {evalRunning ? "Running V1–V5..." : "Run V1–V5 Benchmark"}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left bg-slate-900">
                <thead className="bg-slate-800 text-slate-300 uppercase">
                  <tr>
                    <th className="p-3">Configuration</th>
                    <th className="p-3">Recall@5</th>
                    <th className="p-3">Precision@5</th>
                    <th className="p-3">MRR</th>
                    <th className="p-3">Faithfulness</th>
                    <th className="p-3">Citation Prec.</th>
                    <th className="p-3">Abstention</th>
                    <th className="p-3">Avg Latency</th>
                    <th className="p-3">P95 Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {evalData.runs.map((r) => (
                    <tr key={r.id} className="border-t border-slate-800">
                      <td className="p-3 font-medium text-indigo-300">{r.version_name}</td>
                      <td className="p-3">{r.recall_at_5}</td>
                      <td className="p-3">{r.precision_at_5}</td>
                      <td className="p-3">{r.mrr}</td>
                      <td className="p-3">{r.faithfulness}</td>
                      <td className="p-3">{r.citation_precision}</td>
                      <td className="p-3">{r.abstention_accuracy}</td>
                      <td className="p-3">{r.avg_latency_ms} ms</td>
                      <td className="p-3">{r.p95_latency_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {evalData.failure_examples.length > 0 && (
              <div className="surface-hover p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <h3 className="font-semibold text-sm">Failure Examples (Diagnostic)</h3>
                {evalData.failure_examples.map((f, i) => (
                  <div key={i} className="text-xs p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-amber-400">[{f.category} • {f.language}]</span> {f.question}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
