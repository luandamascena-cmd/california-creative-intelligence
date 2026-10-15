/** Imagem de fundo desfocada, atrás de todos os painéis em vidro. Troque o arquivo em public/brand/fundo-central.webp. */
export function Backdrop() {
  return (
    <div className="ci-backdrop" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/fundo-central.webp" alt="" />
    </div>
  );
}
