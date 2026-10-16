"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const INTERVAL = 7000;
const FALLBACK = [{ src: "/brand/fundo-central.webp", position: "50% 50%" }];

/**
 * Fundo da página da regional: fotos da cidade em tela cheia, desfocadas e alternando.
 * Mesma camada vermelha e escura da central, para os painéis em vidro continuarem legíveis.
 * As fotos de cada cidade ficam em lib/regions.ts (campo photos).
 */
export function CitySlideshow({ photos }: { photos: { src: string; position?: string }[]; city: string }) {
  const list = photos.length ? photos : FALLBACK;
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (list.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % list.length), INTERVAL);
    return () => window.clearInterval(id);
  }, [list.length]);

  useEffect(() => {
    if (list.length < 2) return;
    const next = new Image();
    next.src = list[(i + 1) % list.length].src;
  }, [i, list]);

  const img = list[i % list.length];
  // Com uma foto só, o movimento lento de aproximação mantém o fundo vivo.
  const drift = reduce ? 1 : 1.12;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink">
      <div className="absolute -inset-10" style={{ filter: "blur(16px) saturate(125%)" }}>
        <AnimatePresence initial={false}>
          <motion.img
            key={img.src}
            src={img.src}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
            style={{ objectPosition: img.position ?? "50% 50%" }}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: drift }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: reduce ? 0.6 : 1.8, ease: "easeInOut" },
              scale: list.length < 2 ? { duration: 24, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" } : { duration: (INTERVAL + 1800) / 1000, ease: "linear" },
            }}
          />
        </AnimatePresence>
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 38%, rgba(231,16,61,0.22) 0%, rgba(231,16,61,0) 70%), radial-gradient(ellipse at 50% 0%, rgba(11,11,12,0.4) 0%, rgba(11,11,12,0.72) 60%, rgba(11,11,12,0.9) 100%)",
        }}
      />
    </div>
  );
}
