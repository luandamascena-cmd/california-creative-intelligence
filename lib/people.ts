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

export function personPhoto(name: string): string | null {
  const slug = personSlug(name);
  return PEOPLE_PHOTOS.includes(slug) ? `/brand/pessoas/${slug}.webp` : null;
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
