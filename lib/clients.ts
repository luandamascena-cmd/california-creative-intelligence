// Identidade de cada cliente na faixa Clientes em Pauta.
//
// Clientes: logo em branco sobre a cor da marca. Marcas do ecossistema California (BUs e IPs):
// logo em branco sobre preto, todas no mesmo padrão.
//
// Para incluir ou trocar um logo: gere um PNG quadrado de 320 px, logo em branco com fundo transparente
// e margem de respiro (o script scratch build_logos.py faz isso a partir do arquivo original),
// salve em public/brand/clientes/<slug>.png e marque `logo: true` abaixo.
// Sem logo, a bolinha mostra o nome do cliente em tipografia, na cor da marca.
import { personSlug } from "./people";

export interface ClientBrand {
  /** Cor de fundo da bolinha. */
  color: string;
  /** Existe public/brand/clientes/<slug>.png. */
  logo?: boolean;
  /** Fundo claro: logo e texto em preto. */
  dark?: boolean;
  /** Marca da casa (BU ou IP da California): fundo preto padronizado. */
  internal?: boolean;
  /** Texto curto para a marca tipográfica, quando não há logo. */
  mark?: string;
}

const HOUSE = "#0B0B0C";
const house = (logo = false, mark?: string): ClientBrand => ({ color: HOUSE, internal: true, logo, mark });

export const CLIENT_BRANDS: Record<string, ClientBrand> = {
  // Ecossistema California
  california: house(true),
  "content-house": house(true),
  originals: house(true),
  creators: house(true),
  "creators-shop": house(true),
  "a-sacada": house(true),
  "ceos-talk-show": house(true),
  "depois-do-like": house(true),
  habitat: house(true),
  "imperio-da-atencao": house(false, "Império"),
  "pedro-bial": house(false, "Bial"),
  "rasgando-nda": house(false, "NDA"),
  "nao-repare-a-bagunca": house(false, "NRAB"),

  // Clientes
  amazon: { color: "#232F3E", logo: true },
  ambev: { color: "#0050F0", logo: true },
  antarctica: { color: "#003DA5" },
  "assai-atacadista": { color: "#F37021", mark: "Assaí" },
  bagaggio: { color: "#3B2A20" },
  "beach-park": { color: "#0072CE", mark: "Beach Park" },
  beats: { color: "#E01F3D", logo: true },
  "beck-s": { color: "#00573F", mark: "Beck's" },
  "boca-rosa": { color: "#E8557A", mark: "Boca Rosa" },
  bohemia: { color: "#1F2A44" },
  brahma: { color: "#C8102E", logo: true },
  "brutal-fruit": { color: "#C4006A", mark: "Brutal Fruit" },
  budweiser: { color: "#C6002D", mark: "Bud" },
  caracu: { color: "#2B1A12" },
  cazetv: { color: "#FFD100", dark: true, mark: "CazéTV" },
  chama: { color: "#FF5A1F", mark: "Chama!" },
  "city-residences-bahia": { color: "#355C7D", mark: "City" },
  colorado: { color: "#E87722" },
  construcap: { color: "#1F4E79" },
  corona: { color: "#0A2D6E" },
  deezer: { color: "#A238FF" },
  "do-bem": { color: "#F28C00", mark: "do bem" },
  educbank: { color: "#3A2BD1", logo: true },
  "flying-fish": { color: "#0089C7", mark: "Flying Fish" },
  fusion: { color: "#1A1A1A" },
  gatorade: { color: "#F96302", logo: true },
  gocase: { color: "#E6007E" },
  "goose-island": { color: "#1D2D5C", mark: "Goose" },
  "growth-suplementos": { color: "#D7141A", mark: "Growth" },
  "guarana-antarctica": { color: "#00843D", mark: "Guaraná" },
  h2oh: { color: "#00A651", mark: "H2OH!" },
  hoegaarden: { color: "#2A6EBB" },
  "j-macedo": { color: "#E30613", mark: "J.Macêdo" },
  "l-oreal": { color: "#111111", mark: "L'Oréal" },
  leffe: { color: "#6B2C1A" },
  "lorena-improta": { color: "#C2185B", mark: "Lorena" },
  "mercado-livre": { color: "#FFE600", dark: true, mark: "Mercado Livre" },
  "michelob-ultra": { color: "#0033A0", mark: "Michelob" },
  "nacional-gas": { color: "#003F87", mark: "Nacional Gás" },
  natura: { color: "#F18A00" },
  nestle: { color: "#5E4B3C", mark: "Nestlé" },
  nike: { color: "#111111", logo: true },
  "o-boticario": { color: "#006A4E", logo: true },
  "one-hundred": { color: "#4A4A4A", mark: "100" },
  original: { color: "#9E1B32" },
  patagonia: { color: "#1F2A44" },
  "patria-investimentos": { color: "#0A2240", logo: true },
  pepsi: { color: "#004B93" },
  polar: { color: "#0072BC" },
  "schaefer-yachts": { color: "#0B1F3A", mark: "Schaefer" },
  seara: { color: "#E2231A" },
  sebrae: { color: "#005EB8", mark: "SEBRAE" },
  serramalte: { color: "#A6192E" },
  skol: { color: "#FFD100", dark: true },
  "soda-antarctica": { color: "#00A651", mark: "Soda" },
  spaten: { color: "#00563F" },
  "st-marche": { color: "#7A0F2E", mark: "St. Marche" },
  "stella-artois": { color: "#B30838", logo: true },
  sukita: { color: "#FF6F00" },
  tiktok: { color: "#111111", logo: true },
  unimed: { color: "#00995D" },
  "urbia-parques": { color: "#3E8E41", mark: "Urbia" },
  wals: { color: "#2E2A25", mark: "Wäls" },
  youtube: { color: "#FF0000", logo: true },
  zupper: { color: "#0095AC", logo: true },
  "agua-ama": { color: "#29ABE2", mark: "AMA" },
  anima: { color: "#4B1E78", logo: true },
};

export const clientSlug = personSlug;

/** Paleta neutra e estável para clientes ainda fora do mapa (a cor sai do nome). */
const FALLBACK = ["#3D5A80", "#6D597A", "#B56576", "#457B9D", "#2A9D8F", "#8D6E63", "#5C6BC0", "#A0522D"];

export interface ResolvedBrand extends ClientBrand {
  src: string | null;
  label: string;
}

export function clientBrand(name: string): ResolvedBrand {
  const slug = clientSlug(name);
  const b = CLIENT_BRANDS[slug];
  const hash = [...slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const base: ClientBrand = b ?? { color: FALLBACK[hash % FALLBACK.length] };
  return { ...base, src: base.logo ? `/brand/clientes/${slug}.png` : null, label: base.mark ?? name };
}

/** Compatibilidade com quem só precisa do caminho do logo. */
export function clientLogo(name: string): string | null {
  return clientBrand(name).src;
}
