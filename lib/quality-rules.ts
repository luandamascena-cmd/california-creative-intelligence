// Decisões do time sobre a qualidade dos dados. Edite aqui para silenciar alertas já verificados.

/**
 * Demandas com mesmo nome, cliente e datas que o time confirmou serem diferentes.
 * Use o nome exato da guia e da tarefa como estão na planilha.
 */
export const CONFIRMED_DISTINCT: { tab: string; task: string }[] = [
  { tab: "SP | Content House", task: "Pedro Bial - Formatos" },
];

/**
 * Pessoas que aparecem na pauta mas não fazem parte da equipe de criação.
 * Ficam fora de todas as contagens (colaboradores, carga, insights, termômetro).
 * Basta o primeiro e o último nome: "Louis Millard" também reconhece "Louis Henry Riechert Millard".
 */
export const NOT_CREATIVE_TEAM = ["Louis Millard", "Carolina Barakat"];

const tokens = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const EXCLUDED = NOT_CREATIVE_TEAM.map(tokens);

export function isOutsideCreativeTeam(name: string): boolean {
  const t = new Set(tokens(name));
  return EXCLUDED.some((ex) => ex.every((w) => t.has(w)));
}
