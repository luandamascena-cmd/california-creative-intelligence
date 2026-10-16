// Onde cada regional aparece nos mapas da central. Edite aqui se a sede de uma regional mudar.
// Depois de editar, rode `npm run map` para regerar os mapas.

export interface RegionalPlace {
  name: string;
  city: string;
  /** Sigla curta, usada só no menu lateral recolhido. */
  short: string;
  /** Estado onde fica a sede (contorno do mapa da página da regional). */
  uf: string;
  state: string;
  lat: number;
  lon: number;
  /** Fotos da cidade para o fundo desfocado da página da regional (public/brand). */
  photos: { src: string; position?: string }[];
}

export const REGIONAL_PLACES: Record<string, RegionalPlace> = {
  NO: { name: "Norte", city: "Fortaleza", short: "FOR", uf: "CE", state: "Ceará", lat: -3.73, lon: -38.52,
    // Provisório: fotos de mar até chegarem as fotos de Fortaleza.
    photos: [{ src: "/brand/09-surf-dourado.webp" }, { src: "/brand/10-surf-entardecer.webp", position: "60% 55%" }, { src: "/brand/11-ceu-violeta.webp" }] },
  NE: { name: "Nordeste", city: "Salvador", short: "SSA", uf: "BA", state: "Bahia", lat: -12.97, lon: -38.5,
    photos: [{ src: "/brand/04-salvador.webp" }] },
  RJ: { name: "Rio de Janeiro", city: "Rio de Janeiro", short: "RJ", uf: "RJ", state: "Rio de Janeiro", lat: -22.91, lon: -43.17,
    photos: [] },
  SP: { name: "São Paulo", city: "São Paulo", short: "SP", uf: "SP", state: "São Paulo", lat: -23.55, lon: -46.63,
    photos: [{ src: "/brand/01-casa-fachada.webp", position: "50% 40%" }, { src: "/brand/03-casa-patio.webp", position: "40% 50%" }, { src: "/brand/02-casa-letreiro.webp", position: "50% 55%" }] },
};

/** Ordem de exibição (de cima para baixo no mapa). */
export const REGIONAL_ORDER = ["NO", "NE", "RJ", "SP"];
