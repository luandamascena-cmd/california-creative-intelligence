// Roda a normalização sobre o snapshot e imprime os indicadores para conferência.
import { readFileSync } from "node:fs";
import { normalizeWorkbook } from "../lib/normalize";

const snap = JSON.parse(readFileSync("data/demo-snapshot.json", "utf8"));
const now = new Date(process.argv[2] ?? snap.capturedAt);
const r = normalizeWorkbook(snap.sheets, now);
const open = r.demands.filter((d) => d.isOpen);
console.log("Demandas:", r.demands.length, "| abertas:", open.length);
console.log("Projetos estimados:", new Set(r.demands.map((d) => d.projectKey)).size);
console.log("Clientes:", new Set(r.demands.map((d) => d.client)).size);
console.log("Pessoas:", new Set(r.demands.flatMap((d) => d.people)).size);
const by = (f: (d: any) => string, list = r.demands) => Object.entries(list.reduce((a: any, d) => ((a[f(d)] = (a[f(d)] ?? 0) + 1), a), {})).sort((a: any, b: any) => b[1] - a[1]);
console.log("Status:", by((d) => d.status));
console.log("BU:", by((d) => d.bu));
console.log("Reconciliação:", r.reconciliation);
console.log("Issues:"); r.issues.forEach((i) => console.log(" -", i.severity, i.code, i.message));
const multi = new Map<string, string[]>();
r.demands.forEach((d) => multi.set(d.projectKey, [...(multi.get(d.projectKey) ?? []), d.task]));
console.log("Projetos com >1 demanda:"); multi.forEach((v, k) => v.length > 1 && console.log("  ", k, "=>", v));
