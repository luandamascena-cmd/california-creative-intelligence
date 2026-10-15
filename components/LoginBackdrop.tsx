"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** Imagens de fundo da tela de acesso, em tela cheia e alternando em sequência. */
export const BACKDROPS = [
  { src: "/brand/01-casa-fachada.webp", alt: "Fachada da Casa California em São Paulo", position: "50% 40%" },
  { src: "/brand/04-salvador.webp", alt: "Vista aérea de Salvador e da Baía de Todos os Santos", position: "50% 50%" },
  { src: "/brand/05-skate.webp", alt: "Ilustração de skatistas na cidade", position: "55% 50%" },
  { src: "/brand/03-casa-patio.webp", alt: "Pátio interno da Casa California", position: "40% 50%" },
  { src: "/brand/06-surf.webp", alt: "Surfista em uma onda grande, em preto e branco", position: "50% 55%" },
  { src: "/brand/02-casa-letreiro.webp", alt: "Letreiro da Casa California", position: "50% 55%" },
];

const INTERVAL = 7000;

export function LoginBackdrop() {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % BACKDROPS.length), INTERVAL);
    return () => window.clearInterval(id);
  }, []);

  // Pré-carrega a próxima imagem para a troca acontecer sem tela vazia.
  useEffect(() => {
    const next = new Image();
    next.src = BACKDROPS[(i + 1) % BACKDROPS.length].src;
  }, [i]);

  const img = BACKDROPS[i];
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-ink">
      <AnimatePresence initial={false}>
        <motion.img
          key={img.src}
          src={img.src}
          alt=""
          draggable={false}
          fetchPriority={i === 0 ? "high" : "auto"}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{ objectPosition: img.position }}
          initial={{ opacity: 0, scale: reduce ? 1 : 1.08 }}
          animate={{ opacity: 1, scale: reduce ? 1 : 1.0 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: reduce ? 0.6 : 1.6, ease: "easeInOut" }, scale: { duration: (INTERVAL + 1600) / 1000, ease: "linear" } }}
        />
      </AnimatePresence>

      {/* Camadas de contraste: garantem leitura do logo e do campo de senha sobre qualquer foto. */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(11,11,12,0.55) 0%, rgba(11,11,12,0.15) 60%, rgba(11,11,12,0.6) 100%)" }} />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

      {/* Indicador discreto da sequência */}
      <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1.5">
        {BACKDROPS.map((b, n) => (
          <span key={b.src} className="h-[2px] w-6 overflow-hidden rounded-full bg-white/20">
            {n === i && (
              <motion.span
                className="block h-full bg-paper"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: INTERVAL / 1000, ease: "linear" }}
              />
            )}
            {n < i && <span className="block h-full w-full bg-paper/60" />}
          </span>
        ))}
      </div>
    </div>
  );
}
