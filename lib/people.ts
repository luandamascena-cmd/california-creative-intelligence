// Fotos dos colaboradores (círculos do gráfico Demandas por Colaboradores).
// Para incluir uma foto: salve em public/brand/pessoas/<nome-sem-acento>.webp (ex.: luan-damascena.webp)
// e acrescente o mesmo nome à lista abaixo. Quem não tem foto aparece com as iniciais.

export const PEOPLE_PHOTOS: string[] = [];

export const personSlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Fotos vindas do e-mail corporativo (diretório do Google), carregadas junto com os dados. */
let directoryPhotos: Record<string, string> = {};
export function setDirectoryPhotos(map: Record<string, string> | undefined) {
  directoryPhotos = map ?? {};
}

/** Foto local (public/brand/pessoas) tem prioridade; depois a do e-mail corporativo. */
export function personPhoto(name: string): string | null {
  const slug = personSlug(name);
  if (PEOPLE_PHOTOS.includes(slug)) return `/brand/pessoas/${slug}.webp`;
  return directoryPhotos[slug] ?? null;
}

/**
 * Liga cada nome da pauta a uma pessoa do diretório. Os nomes nem sempre batem
 * ("Paula Letícia Brandão Sereno" na pauta, "Paula Sereno" no Google), então a busca tenta,
 * nesta ordem: nome igual, e-mail no padrão nome+sobrenome, e primeiro nome + um sobrenome em comum.
 * Só aceita quando há um candidato único, para nunca trocar a foto de alguém.
 */
export function matchDirectoryPhotos(names: string[], people: { name: string; email: string; photo: string }[]): Record<string, string> {
  const dir = people
    .filter((p) => p.photo)
    .map((p) => ({ ...p, slug: personSlug(p.name), tokens: personSlug(p.name).split("-").filter(Boolean), local: (p.email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") }));
  const out: Record<string, string> = {};
  for (const name of names) {
    const slug = personSlug(name);
    const t = slug.split("-").filter(Boolean);
    if (!t.length) continue;
    const pick = (list: typeof dir) => (list.length === 1 ? list[0].photo : null);
    const combos = new Set(t.slice(1).map((x) => t[0] + x));
    if (t.length === 1) combos.add(t[0]);
    const found =
      pick(dir.filter((d) => d.slug === slug)) ??
      pick(dir.filter((d) => combos.has(d.local))) ??
      pick(dir.filter((d) => d.tokens[0] === t[0] && d.tokens.slice(1).some((x) => t.slice(1).includes(x))));
    if (found) out[slug] = found;
  }
  return out;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Primeiro e último nome, para caber embaixo da foto. */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
}
