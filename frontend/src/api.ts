const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function getToken(): string | null {
  return localStorage.getItem("knowflow_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("knowflow_token", token);
  } else {
    localStorage.removeItem("knowflow_token");
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err.detail || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_size_bytes: number;
  status: string;
  error_message?: string | null;
  page_count: number;
  chunk_count: number;
  ocr_pages: number;
  category: string;
  created_at: string;
}

export interface CitationItem {
  document_id: string;
  chunk_id: string;
  filename: string;
  page_number: number;
  section_title?: string;
  quote: string;
}

export interface ClaimCitation {
  claim_text: string;
  evidence_ids: string[];
  verification_status: "supported" | "partially_supported" | "unsupported" | "contradicted";
  citations: CitationItem[];
}

export interface ConflictItem {
  subject: string;
  source_a: string;
  statement_a: string;
  source_b: string;
  statement_b: string;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  status: "answered" | "abstained" | "conflict";
  answer: string;
  rewritten_query: string;
  insufficient_evidence: boolean;
  claims: ClaimCitation[];
  conflicts: ConflictItem[];
  latency_ms: number;
  estimated_cost_usd: number;
}

export const api = {
  register: (email: string, password: string, full_name: string) =>
    request<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),

  listDocuments: () => request<DocumentItem[]>("/documents"),
  uploadDocument: (file: File, category = "general") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    return request<DocumentItem>("/documents/upload", { method: "POST", body: fd });
  },
  deleteDocument: (id: string) =>
    request<void>(`/documents/${id}`, { method: "DELETE" }),
  retryDocument: (id: string) =>
    request<DocumentItem>(`/documents/${id}/retry`, { method: "POST" }),
  getDocumentFileUrl: (id: string, page?: number) => {
    const base = `${API_BASE}/documents/${id}/file`;
    return page ? `${base}#page=${page}` : base;
  },
  openDocumentAtPage: async (id: string, page: number) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/documents/${id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Unable to open PDF (${res.status})`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(`${blobUrl}#page=${page}`, "_blank", "noopener,noreferrer");
  },

  chat: (payload: {
    question: string;
    conversation_id?: string | null;
    document_ids?: string[] | null;
    language?: string;
    use_reranker?: boolean;
    use_query_rewrite?: boolean;
  }) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listConversations: () =>
    request<{ id: string; title: string; created_at: string }[]>("/conversations"),
  getConversation: (id: string) =>
    request<{ id: string; title: string; messages: any[] }>(`/conversations/${id}`),
  sendFeedback: (messageId: string, feedback: "helpful" | "not_helpful") =>
    request<void>(`/messages/${messageId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    }),

  comparePapers: (document_ids: string[], topic: string) =>
    request<{ topic: string; documents: { id: string; filename: string }[]; rows: any[] }>(
      "/research/compare",
      { method: "POST", body: JSON.stringify({ document_ids, topic }) }
    ),
  generateSummary: (document_id: string, summary_type: string) =>
    request<{ document_id: string; filename: string; summary_type: string; sections: any[] }>(
      "/summaries/generate",
      { method: "POST", body: JSON.stringify({ document_id, summary_type }) }
    ),
  generateQuiz: (document_id: string, num_questions: number) =>
    request<{ document_id: string; filename: string; items: any[] }>("/quizzes/generate", {
      method: "POST",
      body: JSON.stringify({ document_id, num_questions }),
    }),

  getEvaluationSummary: () =>
    request<{ runs: any[]; failure_examples: any[] }>("/evaluation/summary"),
  runEvaluation: (versions: string[]) =>
    request<{ runs: any[] }>("/evaluation/run", {
      method: "POST",
      body: JSON.stringify({ versions }),
    }),
};
