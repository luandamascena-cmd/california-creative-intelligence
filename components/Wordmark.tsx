/** Assinatura espaçada "C L F R N" / "CALIFORNIA", como nos materiais da marca. */
export function Wordmark({ full = false, className = "" }: { full?: boolean; className?: string }) {
  const text = full ? "CALIFORNIA" : "CLFRN";
  return (
    <span aria-label="California" className={`font-mark font-bold uppercase text-paper ${className}`}>
      {text.split("").map((ch, i) => (
        <span key={i} aria-hidden className="inline-block" style={{ marginRight: i === text.length - 1 ? 0 : "0.55em" }}>
          {ch}
        </span>
      ))}
    </span>
  );
}
