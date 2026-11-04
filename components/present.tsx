"use client";

import { createContext, useContext } from "react";

/**
 * Estado do modo apresentação do Panorama ("modo telão"), lido pelos componentes que animam sozinhos.
 * Fora do Panorama em apresentação, `on` é sempre false e tudo se comporta como antes.
 */
export interface PresentState {
  on: boolean;
  paused: boolean;
  /** Parte do bloco do time em foco no percurso: abertura (status e clientes) ou colaboradores. */
  phase: "top" | "bottom" | null;
}

const PresentCtx = createContext<PresentState>({ on: false, paused: false, phase: null });

export const PresentProvider = PresentCtx.Provider;
export const usePresent = () => useContext(PresentCtx);

/** Roda `step(i)` para os primeiros `count` itens, um a cada `every` ms, depois chama `done`. Devolve a limpeza. */
export function runSequence(count: number, { delay, every }: { delay: number; every: number }, step: (i: number) => void, done: () => void) {
  const timers: number[] = [];
  for (let i = 0; i < count; i++) timers.push(window.setTimeout(() => step(i), delay + i * every));
  timers.push(window.setTimeout(done, delay + count * every));
  return () => timers.forEach((t) => window.clearTimeout(t));
}
