// Logos e ordem dos times executores. Um time sem logo cadastrado aparece com o nome por extenso.

export const TEAM_LOGOS: Record<string, { src: string; w: number; h: number; className: string }> = {
  california: { src: "/brand/logo-california-branco.png", w: 1549, h: 369, className: "h-[32px]" },
  "content house": { src: "/brand/logo-content-house-branco.png", w: 2185, h: 178, className: "h-[22px]" },
};

export const teamKey = (t: string) => t.trim().toLowerCase();

/** California sempre primeiro, Content House em seguida, demais times depois. */
export const teamOrder = (t: string) => {
  const i = Object.keys(TEAM_LOGOS).indexOf(teamKey(t));
  return i === -1 ? 99 : i;
};
