// Logos dos clientes (faixa Clientes em Pauta).
// Para incluir um logo: salve em public/brand/clientes/<nome-sem-acento>.png (ex.: loreal.png, natura.png),
// de preferência quadrado e com fundo, e acrescente o nome do arquivo à lista abaixo.
// Cliente sem logo aparece com as iniciais.
import { personSlug } from "./people";

export const CLIENT_LOGOS: Record<string, string> = {
  california: "/brand/emblema-urso.png",
};

export const clientSlug = personSlug;

export function clientLogo(name: string): string | null {
  return CLIENT_LOGOS[clientSlug(name)] ?? null;
}
