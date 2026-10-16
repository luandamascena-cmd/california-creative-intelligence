"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";

export const RED = "#E7103D";

export interface NetData {
  width: number;
  height: number;
  outline: string;
  nodes: number[][];
  edges: number[][];
}

export interface MapPin {
  code: string;
  label: string;
  x: number;
  y: number;
  ariaLabel: string;
  /** Sem ação, o pino é só indicativo (não clicável). */
  onActivate?: () => void;
}

/** Pseudoaleatório estável por índice, para a animação não "pular" entre renderizações. */
export const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

interface Props {
  net: NetData;
  pins: MapPin[];
  /** Cor e opacidade de cada ponto da rede. */
  nodeColor: (x: number, y: number) => { fill: string; o: number };
  ariaLabel: string;
  onHover?: (code: string | null) => void;
  className?: string;
  /** Escala dos pinos e rótulos (mapas exibidos menores pedem pinos maiores). */
  pinScale?: number;
  /** Quanto o rótulo pode passar da borda direita do mapa antes de ir para a esquerda do pino. */
  labelOverflow?: number;
}

/**
 * Mapa em rede: pontos que cintilam, pulsos vermelhos percorrendo conexões e pinos com o urso.
 * Só o círculo do urso é clicável; o rótulo com o nome é informativo.
 */
export function NetworkMap({ net, pins, nodeColor, ariaLabel, onHover, className = "", pinScale = 1, labelOverflow = 120 }: Props) {
  const reduce = useReducedMotion();
  const colors = useMemo(() => net.nodes.map(([x, y]) => nodeColor(x, y)), [net, nodeColor]);
  const sparks = useMemo(() => net.edges.filter((_, i) => i % 23 === 0).slice(0, 18), [net]);

  return (
    <div className={`relative mx-auto w-full ${className}`}>
      <svg viewBox={`0 0 ${net.width} ${net.height}`} className="h-auto w-full overflow-visible" role="img" aria-label={ariaLabel}>
        <path d={net.outline} fill="rgba(255,251,240,0.02)" stroke="rgba(255,251,240,0.07)" strokeWidth={1} />
        <g stroke="rgba(255,251,240,0.12)" strokeWidth={1}>
          {net.edges.map(([a, b], i) => (
            <line key={i} x1={net.nodes[a][0]} y1={net.nodes[a][1]} x2={net.nodes[b][0]} y2={net.nodes[b][1]} />
          ))}
        </g>
        {!reduce && (
          <g>
            {sparks.map(([a, b], i) => {
              const [x1, y1] = net.nodes[a];
              const [x2, y2] = net.nodes[b];
              const dur = 2.6 + rnd(i, 3) * 2.4;
              const begin = rnd(i, 7) * 4;
              return (
                <circle key={i} r={3.2} fill={RED} opacity={0}>
                  <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={`M ${x1} ${y1} L ${x2} ${y2}`} />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
                </circle>
              );
            })}
          </g>
        )}
        <g>
          {net.nodes.map(([x, y, hub], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={hub ? 6.5 : 5}
              fill={colors[i].fill}
              className="ci-twinkle"
              style={
                {
                  "--o": colors[i].o,
                  "--d": `${3 + rnd(i) * 4}s`,
                  "--delay": `${-rnd(i, 2) * 6}s`,
                  opacity: colors[i].o,
                } as React.CSSProperties
              }
            />
          ))}
        </g>

        {pins.map((p, k) => {
          const { x, y } = p;
          const s = pinScale;
          const w = (30 + p.label.length * 9.4) * s;
          // Rótulo à esquerda quando há outro pino logo à direita ou quando faltaria espaço.
          const crowded = pins.some((o) => o !== p && o.x > x && o.x - x < 150 && Math.abs(o.y - y) < 70);
          const left = crowded || x + 52 * s + w > net.width + labelOverflow;
          const lx = left ? x - 52 * s - w : x + 52 * s;
          return (
            <g key={p.code} style={{ color: RED }} onMouseEnter={() => onHover?.(p.code)} onMouseLeave={() => onHover?.(null)}>
              <g
                {...(p.onActivate
                  ? {
                      className: "ci-pin",
                      role: "link",
                      tabIndex: 0,
                      "aria-label": p.ariaLabel,
                      onClick: p.onActivate,
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          p.onActivate?.();
                        }
                      },
                    }
                  : { "aria-hidden": true, pointerEvents: "none" })}
              >
                {p.onActivate && <title>{p.ariaLabel}</title>}
                <circle cx={x} cy={y} r={46 * s} fill="#0B0B0C" opacity={0.8} />
                {[44, 36, 29].map((rad, j) => (
                  <circle key={rad} cx={x} cy={y} r={rad * s} fill="none" stroke="currentColor" strokeOpacity={0.22 + j * 0.12} strokeWidth={1.5 * s} />
                ))}
                {!reduce && (
                  <>
                    <circle cx={x} cy={y} r={24 * s} fill="none" stroke="currentColor" strokeWidth={2 * s} className="ci-ping" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${k * 0.6}s` }} />
                    <circle cx={x} cy={y} r={24 * s} fill="none" stroke="currentColor" strokeWidth={1.5 * s} className="ci-ping" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${k * 0.6 + 1.2}s` }} />
                  </>
                )}
                <circle cx={x} cy={y} r={22 * s} fill="currentColor" />
                <image href="/brand/emblema-urso.png" x={x - 16 * s} y={y - 16 * s} width={32 * s} height={32 * s} />
              </g>
              <g transform={`translate(${lx} ${y - 17 * s})`} pointerEvents="none" aria-hidden>
                <rect width={w} height={34 * s} rx={17 * s} fill="rgba(20,20,22,0.72)" stroke="rgba(255,255,255,0.18)" />
                <text x={w / 2} y={22.5 * s} textAnchor="middle" fill="#FFFBF0" fontSize={15 * s} fontFamily="Archivo, system-ui, sans-serif" fontWeight={600}>
                  {p.label}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
