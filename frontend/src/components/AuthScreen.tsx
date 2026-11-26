import React, { useState } from "react";
import { ArrowRight, Fingerprint, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { api, setToken, User } from "../api";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

const HIGHLIGHTS = [
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    title: "Claim-level citations",
    body: "Every sentence is traced back to the exact PDF page it came from.",
  },
  {
    icon: <Layers className="w-4 h-4" />,
    title: "Multi-paper comparison",
    body: "Line two to five papers up across problem, method, dataset and results.",
  },
  {
    icon: <Fingerprint className="w-4 h-4" />,
    title: "Abstains when unsure",
    body: "No evidence in your library means no invented answer.",
  },
];

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "register"
          ? await api.register(email, password, fullName)
          : await api.login(email, password);
      setToken(result.access_token);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        {/* Brand side */}
        <section className="animate-fade-up order-2 lg:order-1">
          <div className="flex items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(45,212,191,0.35)] bg-[rgba(45,212,191,0.12)] text-[color:var(--color-accent)]">
              <Sparkles className="h-5 w-5" />
              <span className="absolute inset-0 rounded-2xl animate-pulse-ring" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">ScholarMind</div>
              <div className="text-[11px] text-slate-500">Intelligent Document Analysis</div>
            </div>
          </div>

          <h1 className="display-title mt-10 text-4xl leading-[1.05] text-white sm:text-5xl">
            Research that shows
            <span className="block italic text-[color:var(--color-accent)] glow-accent">
              its own receipts.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            Upload your PDFs, ask in English or বাংলা, and get answers assembled from cited
            passages — with contradictions between sources surfaced rather than smoothed over.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item, index) => (
              <li
                key={item.title}
                className="surface-hover animate-fade-up flex items-start gap-3 rounded-xl border border-[color:var(--color-line)] bg-[rgba(9,14,21,0.55)] px-3.5 py-3"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <span className="mt-0.5 text-[color:var(--color-accent)]">{item.icon}</span>
                <div>
                  <div className="text-xs font-semibold text-slate-100">{item.title}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{item.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Form side */}
        <section
          className="animate-fade-up order-1 w-full lg:order-2"
          style={{ animationDelay: "80ms" }}
        >
          <Panel interactive className="p-6 sm:p-7">
            <div className="mb-5">
              <div className="eyebrow">{isRegister ? "New workspace" : "Welcome back"}</div>
              <h2 className="display-title mt-1 text-2xl text-white">
                {isRegister ? "Create your account" : "Sign in to continue"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {isRegister && (
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-400">Full name</span>
                  <input
                    className="field"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">Email</span>
                <input
                  className="field"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">Password</span>
                <input
                  className="field"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
              </label>

              {error && (
                <p className="rounded-lg border border-[rgba(251,113,133,0.35)] bg-[rgba(76,5,25,0.4)] px-3 py-2 text-[11px] text-[#ffd5dc]">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={busy}
                className="w-full"
                trailing={!busy ? <ArrowRight className="h-3.5 w-3.5" /> : undefined}
              >
                {busy ? "Please wait" : isRegister ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                {isRegister ? "Already registered?" : "No account yet?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode(isRegister ? "login" : "register");
                  setError("");
                }}
                className="font-medium text-[color:var(--color-accent)] transition hover:text-[color:var(--color-accent-soft)]"
              >
                {isRegister ? "Sign in instead" : "Create one"}
              </button>
            </div>
          </Panel>

          <p className="mt-4 text-center text-[10px] text-slate-600">
            Documents are scoped to your account. Nothing is shared across workspaces.
          </p>
        </section>
      </div>
    </div>
  );
}
