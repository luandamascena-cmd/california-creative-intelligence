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

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-ink px-4">
      <LoginBackdrop />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full max-w-[520px] flex-col items-center text-center"
      >
        <h1 className="w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-california-branco.png"
            alt="California"
            width={1549}
            height={369}
            className="mx-auto h-auto w-[78%] max-w-[440px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
          />
        </h1>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="my-6 h-px w-20 origin-center bg-clf-red"
        />
        <p className="display text-[20px] tracking-[0.32em] text-paper sm:text-[22px]">Creative Intelligence</p>
        <p className="mt-3 max-w-[320px] text-[13px] leading-relaxed text-paper-dim">
          Pauta de criação de todas as regionais e times, em tempo real.
        </p>

        <form onSubmit={submit} className="mt-10 w-full">
          <label htmlFor="password" className="sr-only">
            Senha de acesso
          </label>
          <div className="glass group flex h-14 items-center gap-2 rounded-full pl-5 pr-1.5 transition">
            <Lock size={15} className="text-paper-dim" aria-hidden />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-full flex-1 bg-transparent text-[14px] text-paper placeholder:text-paper-mute focus:outline-none"
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
            />
            <button
              type="submit"
              disabled={loading || !password}
              className="glass-btn flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-paper transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <>Entrar <ArrowRight size={15} /></>}
            </button>
          </div>
          <div className="mt-3 h-5 text-[12.5px]" role="alert" id="login-error">
            {error && <span className="rounded bg-black/50 px-2 py-0.5 text-[#ff8a75]">{error}</span>}
          </div>
        </form>
      </motion.div>

      <footer className="absolute bottom-6 z-10 text-[11px] tracking-[0.3em] text-paper-mute">C O N F I D E N T I A L</footer>
    </main>
  );
}
