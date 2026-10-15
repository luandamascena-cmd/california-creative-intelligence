"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { LoginBackdrop } from "@/components/LoginBackdrop";

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

  const input = (
    <input
      id="password"
      type="password"
      autoComplete="current-password"
      autoFocus
      placeholder="Senha de acesso"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-paper placeholder:text-paper-mute focus:outline-none"
      aria-invalid={!!error}
      aria-describedby={error ? "login-error" : undefined}
    />
  );
  const errorLine = (
    <div className="mt-2.5 h-5 text-[12px]" role="alert" id="login-error">
      {error && <span className="rounded bg-black/50 px-2 py-0.5 text-[#ff8a75]">{error}</span>}
    </div>
  );

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-ink px-4">
      <LoginBackdrop />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        <>
            <p className="display mb-5 text-[13px] tracking-[0.42em] text-paper-dim sm:text-[14px]">Creative Intelligence</p>
            <h1>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/emblema-urso.png"
                alt="California"
                width={370}
                height={369}
                className="mx-auto h-[84px] w-[84px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] sm:h-[96px] sm:w-[96px]"
              />
            </h1>
            <p className="mt-5 whitespace-nowrap text-[12px] text-paper-dim sm:text-[13px]">
              Pauta de criação de todas as regionais em tempo real.
            </p>
            <form onSubmit={submit} className="mt-6 w-[280px] sm:w-[320px]">
              <label htmlFor="password" className="sr-only">
                Senha de acesso
              </label>
              <div className="glass flex h-12 items-center gap-2 rounded-full pl-4 pr-1">
                <Lock size={14} className="shrink-0 text-paper-dim" aria-hidden />
                {input}
                <button
                  type="submit"
                  aria-label="Entrar"
                  disabled={loading || !password}
                  className="glass-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-paper transition disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={16} />}
                </button>
              </div>
              {errorLine}
            </form>
          </>
      </motion.div>

      <footer className="absolute bottom-6 z-10 text-[11px] tracking-[0.3em] text-paper-mute">C O N F I D E N T I A L</footer>
    </main>
  );
}
