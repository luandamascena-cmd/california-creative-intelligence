// Gera lib/brazil-network.json: o Brasil desenhado como uma rede de pontos e conexões,
// com a posição de cada regional. Roda só em desenvolvimento (npm run map).
import { writeFileSync, readFileSync } from "node:fs";
import { geoMercator, geoContains, geoPath } from "d3-geo";
import { Delaunay } from "d3-delaunay";
import { feature } from "topojson-client";
import { REGIONAL_PLACES } from "../lib/regions";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
const countries = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
const brazil = countries.features.find((f) => String(f.id) === "076")!;

const W = 1000, H = 1000;
const proj = geoMercator().fitExtent([[40, 30], [W - 40, H - 30]], brazil);
const outline = geoPath(proj)(brazil)!;

// Pontos de amostragem com distância mínima (dart throwing determinístico).
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pts: [number, number][] = [];
const MIN = 44;
for (let k = 0; k < 60000 && pts.length < 240; k++) {
  const x = 40 + rand() * (W - 80), y = 30 + rand() * (H - 60);
  const ll = proj.invert!([x, y])!;
  if (!geoContains(brazil, ll)) continue;
  if (pts.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < MIN * MIN)) continue;
  pts.push([x, y]);
}

// Pinos das regionais entram como pontos da rede.
const pins: Record<string, [number, number]> = {};
for (const [code, p] of Object.entries(REGIONAL_PLACES)) {
  const [x, y] = proj([p.lon, p.lat])!;
  for (let i = pts.length - 1; i >= 0; i--) if ((pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2 < (MIN * 0.8) ** 2) pts.splice(i, 1);
  pts.push([x, y]);
  pins[code] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

// Conexões: triangulação com arestas curtas, mais alguns "hubs" com raios longos.
const del = Delaunay.from(pts);
const edges = new Set<string>();
const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const dist = (a: number, b: number) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
for (let t = 0; t < del.triangles.length; t += 3) {
  const [a, b, c] = [del.triangles[t], del.triangles[t + 1], del.triangles[t + 2]];
  for (const [u, v] of [[a, b], [b, c], [c, a]]) if (dist(u, v) < 78 && rand() < 0.78) edges.add(key(u, v));
}
const hubs: number[] = [];
for (let tries = 0; tries < 400 && hubs.length < 9; tries++) {
  const i = Math.floor(rand() * pts.length);
  if (hubs.every((h) => dist(h, i) > 200)) hubs.push(i);
}
for (const h of hubs) for (let j = 0; j < pts.length; j++) if (j !== h && dist(h, j) < 170 && rand() < 0.55) edges.add(key(h, j));

const nodes = pts.map(([x, y], i) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, hubs.includes(i) ? 1 : 0]);
writeFileSync(
  "lib/brazil-network.json",
  JSON.stringify({ width: W, height: H, outline, nodes, edges: [...edges].map((e) => e.split("-").map(Number)), pins }),
);
console.log(`${nodes.length} pontos, ${edges.size} conexões, pinos:`, pins);
