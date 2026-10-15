"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Não foi possível entrar.");
      window.location.replace("/");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      {/* Linhas de grade discretas, evocando um painel de monitoramento */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,251,240,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,251,240,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-clf-red/[0.07] blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full max-w-[440px] flex-col items-center text-center"
      >
        <span className="eyebrow mb-8 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-clf-red" /> Ecossistema California
        </span>
        <h1 className="text-[34px] leading-none sm:text-[44px]">
          <Wordmark full />
        </h1>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="my-6 h-px w-24 origin-center bg-clf-red"
        />
        <p className="display text-[22px] tracking-[0.28em] text-paper-dim">Creative Intelligence</p>
        <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-paper-mute">
          Pauta de criação de todas as regionais e times, em tempo real.
        </p>

        <form onSubmit={submit} className="mt-10 w-full">
          <label htmlFor="password" className="sr-only">
            Senha de acesso
          </label>
          <div className="group flex h-12 items-center gap-2 rounded-xl border border-ink-600 bg-ink-850/80 pl-4 pr-1.5 backdrop-blur transition focus-within:border-clf-red">
            <Lock size={15} className="text-paper-mute" aria-hidden />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-full flex-1 bg-transparent text-[14px] text-paper placeholder:text-paper-faint focus:outline-none"
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
            />
            <button
              type="submit"
              disabled={loading || !password}
              className="flex h-9 items-center gap-2 rounded-lg bg-clf-red px-4 text-[13px] font-semibold text-paper transition hover:brightness-110 disabled:opacity-40"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <>Entrar <ArrowRight size={15} /></>}
            </button>
          </div>
          <div className="mt-3 h-5 text-[12.5px]" role="alert" id="login-error">
            {error && <span className="text-clf-coral">{error}</span>}
          </div>
        </form>
      </motion.div>

      <footer className="absolute bottom-6 text-[11px] tracking-[0.3em] text-paper-faint">C O N F I D E N T I A L</footer>
    </main>
  );
}
