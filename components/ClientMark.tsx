"use client";

import { clientBrand } from "@/lib/clients";

/**
 * Bolinha de um cliente: logo em branco sobre a cor da marca, ou o nome em tipografia quando
 * ainda não há logo. Marcas da casa ficam sobre preto, todas iguais.
 */
export function ClientMark({ name, size, className = "" }: { name: string; size: number; className?: string }) {
  const b = clientBrand(name);
  const ink = b.dark ? "#111111" : "#FFFFFF";
  const words = b.label.split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length), 1);
  // Antonio é condensada: cada caractere ocupa cerca de metade da altura.
  const font = Math.min(size * 0.25, (size * 0.72) / (longest * 0.5), words.length > 1 ? size * 0.2 : size);

  return (
    <span
      style={{ width: size, height: size, background: b.color, color: ink }}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ${b.internal ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]" : ""} ${className}`}
    >
      {b.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.src} alt={name} draggable={false} className="h-full w-full select-none object-contain" style={b.dark ? { filter: "brightness(0)" } : undefined} />
      ) : (
        <span aria-label={name} className="display px-[12%] text-center uppercase leading-[0.95]" style={{ fontSize: font }}>
          {b.label}
        </span>
      )}
    </span>
  );
}
