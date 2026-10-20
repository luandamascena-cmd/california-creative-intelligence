"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Distribui N itens em colunas iguais que ocupam toda a largura disponível, sem sobra na lateral.
 * Usa o maior número de colunas em que cada item ainda tem `minItem` px; com poucos itens,
 * as colunas alargam e o círculo cresce até `maxCircle`.
 */
export function useFitGrid(count: number, { minItem = 96, gap = 12, minCircle = 52, maxCircle = 128, ratio = 0.64 } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const fit = Math.max(1, Math.floor((width + gap) / (minItem + gap)));
  const cols = Math.max(1, Math.min(count || 1, fit));
  const colWidth = width ? (width - gap * (cols - 1)) / cols : minItem;
  const circle = Math.round(Math.min(maxCircle, Math.max(minCircle, colWidth * ratio)));
  return { ref, cols, circle, gap, ready: width > 0 };
}
