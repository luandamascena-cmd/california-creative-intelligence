// Tokens visuais da California aplicados à visualização de dados.
// Paletas categórica e de status validadas para daltonismo sobre a superfície escura (#141415).

export const C = {
  bg: "#0B0B0C",
  card: "#141415",
  surface2: "#19191B",
  line: "#2A2A2E",
  grid: "#232326",
  paper: "#FFFBF0",
  dim: "#D5D3CC",
  mute: "#8F8D88",
  faint: "#5E5D5A",
  red: "#E7103D",
  coral: "#E6523A",
  sand: "#CABEAA",
  /** Barras de série única: off-white quente da marca. */
  mark: "#D9D2C3",
  markSoft: "#8C8579",
};

/** Ordem categórica fixa (nunca reciclada). Cor acompanha a entidade, não a posição. */
export const CATEGORICAL = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
export const OTHER = "#6B6862";

/** Status: mesma cor em todos os gráficos, sempre acompanhada do nome. */
export const STATUS_COLORS: Record<string, string> = {
  pauta: "#3987e5",
  aprovacao: "#c98500",
  briefing: "#9085e9",
  travado: "#d95926",
  finalizado: "#199e70",
  outro: "#6B6862",
};
export const STATUS_ORDER = ["pauta", "aprovacao", "briefing", "travado", "finalizado", "outro"] as const;
export const LATE = "#E7103D";

/** Rampa sequencial de uma só cor (vermelho California), do fundo ao destaque. */
export const SEQUENTIAL = ["#221a1c", "#4a1521", "#7a1129", "#ad0f33", "#e7103d", "#ff6683"];

/** Mapa estável entidade → cor, a partir de uma lista ordenada (ex.: guia Listas). */
export function colorMap(names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  names.forEach((n, i) => (out[n] = i < CATEGORICAL.length ? CATEGORICAL[i] : OTHER));
  return out;
}

export const FONT = "Archivo, system-ui, sans-serif";
export const DISPLAY = "Antonio, Oswald, Impact, sans-serif";

export const tooltipBase = {
  backgroundColor: "#1E1E21",
  borderColor: "#3A3A3F",
  borderWidth: 1,
  padding: [10, 12],
  textStyle: { color: C.paper, fontFamily: FONT, fontSize: 12 },
  extraCssText: "box-shadow:0 10px 30px -10px rgba(0,0,0,.8);border-radius:10px;",
};

export const axisLabel = { color: C.mute, fontFamily: FONT, fontSize: 11 };
export const splitLine = { lineStyle: { color: C.grid, type: "dashed" as const } };
