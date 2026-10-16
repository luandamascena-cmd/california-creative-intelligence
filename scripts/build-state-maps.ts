// Gera lib/state-networks.json: o estado de cada regional desenhado como rede de pontos,
// no mesmo estilo do mapa do Brasil da central. Roda só em desenvolvimento (npm run map).
// Contornos: scripts/data/estados.geojson (SP, CE, BA, RJ). Para uma regional nova,
// inclua o contorno do estado nesse arquivo e a sede em lib/regions.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { geoArea, geoContains, geoMercator, geoPath } from "d3-geo";
import { Delaunay } from "d3-delaunay";
import { REGIONAL_PLACES } from "../lib/regions";

type Feature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { uf: string; name: string }>;
const fc = JSON.parse(readFileSync("scripts/data/estados.geojson", "utf8")) as GeoJSON.FeatureCollection;

/** d3-geo espera anéis no sentido horário; o GeoJSON padrão usa o contrário. */
function rewind(f: Feature): Feature {
  if (geoArea(f) <= 2 * Math.PI) return f;
  const rev = (rings: number[][][]) => rings.map((r) => [...r].reverse());
  const g = f.geometry;
  const coordinates = g.type === "Polygon" ? rev(g.coordinates) : g.coordinates.map(rev);
  return { ...f, geometry: { ...g, coordinates } as typeof g };
}

const out: Record<string, unknown> = {};
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

for (const [code, place] of Object.entries(REGIONAL_PLACES)) {
  const raw = (fc.features as Feature[]).find((f) => f.properties.uf === place.uf);
  if (!raw) {
    console.warn(`Sem contorno para ${place.uf} (${code}).`);
    continue;
  }
  const shape = rewind(raw);
  const W = 1000;
  const probe = geoMercator().fitWidth(W - 80, shape);
  const [[, y0], [, y1]] = geoPath(probe).bounds(shape);
  const H = Math.round(Math.min(1000, Math.max(560, y1 - y0 + 60)));
  const proj = geoMercator().fitExtent([[40, 30], [W - 40, H - 30]], shape);
  const outline = geoPath(proj)(shape)!;
  const area = geoPath(proj).area(shape);

  // Mesma densidade visual para estados grandes e pequenos: cerca de 150 pontos.
  const MIN = Math.sqrt(area / 150) * 0.86;
  const pts: [number, number][] = [];
  for (let k = 0; k < 80000 && pts.length < 190; k++) {
    const x = 40 + rand() * (W - 80), y = 30 + rand() * (H - 60);
    if (pts.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < MIN * MIN)) continue;
    if (!geoContains(shape, proj.invert!([x, y])!)) continue;
    pts.push([x, y]);
  }
  const [px, py] = proj([place.lon, place.lat])!;
  for (let i = pts.length - 1; i >= 0; i--) if ((pts[i][0] - px) ** 2 + (pts[i][1] - py) ** 2 < (MIN * 0.9) ** 2) pts.splice(i, 1);
  pts.push([px, py]);
  const pinIdx = pts.length - 1;

  const del = Delaunay.from(pts);
  const edges = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const dist = (a: number, b: number) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
  for (let t = 0; t < del.triangles.length; t += 3) {
    const [a, b, c] = [del.triangles[t], del.triangles[t + 1], del.triangles[t + 2]];
    for (const [u, v] of [[a, b], [b, c], [c, a]]) if (dist(u, v) < MIN * 1.8 && rand() < 0.8) edges.add(key(u, v));
  }
  // A sede vira o hub principal: raios para os pontos próximos, como na rede nacional.
  const hubs = [pinIdx];
  for (let tries = 0; tries < 400 && hubs.length < 6; tries++) {
    const i = Math.floor(rand() * pts.length);
    if (hubs.every((h) => dist(h, i) > MIN * 4.2)) hubs.push(i);
  }
  for (const h of hubs) for (let j = 0; j < pts.length; j++) if (j !== h && dist(h, j) < MIN * 3.6 && rand() < (h === pinIdx ? 0.8 : 0.5)) edges.add(key(h, j));

  const r1 = (n: number) => Math.round(n * 10) / 10;
  out[code] = {
    uf: place.uf,
    width: W,
    height: H,
    outline,
    nodes: pts.map(([x, y], i) => [r1(x), r1(y), hubs.includes(i) && i !== pinIdx ? 1 : 0]),
    edges: [...edges].map((e) => e.split("-").map(Number)),
    pin: [r1(px), r1(py)],
  };
  console.log(`${code} (${place.uf}): ${pts.length} pontos, ${edges.size} conexões, ${W}×${H}, sede em`, [r1(px), r1(py)]);
}

writeFileSync("lib/state-networks.json", JSON.stringify(out));
