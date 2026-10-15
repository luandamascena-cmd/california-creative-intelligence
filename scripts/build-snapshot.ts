// Gera data/demo-snapshot.json a partir de uma exportação em texto da planilha
// (blocos "## Sheet name: <guia>" seguidos de linhas CSV).
// Uso: npm run snapshot -- <arquivo-exportado>
import { readFileSync, writeFileSync } from "node:fs";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const file = process.argv[2];
if (!file) throw new Error("Informe o arquivo exportado.");
const text = readFileSync(file, "utf8");
const sheets: { title: string; values: string[][] }[] = [];
let current: { title: string; values: string[][] } | null = null;
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^## Sheet name: (.+)$/);
  if (m) { current = { title: m[1].trim(), values: [] }; sheets.push(current); continue; }
  if (!current) continue;
  current.values.push(line.trim() ? parseCsvLine(line) : []);
}
// Mantém só as guias de pauta, Listas e Visão Geral (Links Úteis pode conter senhas).
const keep = (t: string) => t.includes("|") || /^(listas|vis.o geral)$/i.test(t);
for (let i = sheets.length - 1; i >= 0; i--) if (!keep(sheets[i].title)) sheets.splice(i, 1);
sheets.forEach((s) => { while (s.values.length && !s.values[s.values.length - 1].length) s.values.pop(); });
writeFileSync("data/demo-snapshot.json", JSON.stringify({
  label: "Snapshot de demonstração da Pauta de Criação (14/10/2026)",
  capturedAt: "2026-10-15T08:30:00-03:00",
  spreadsheetTitle: "Pauta de Criação | Ecossistema California",
  sheets,
}, null, 0));
console.log(sheets.map((s) => `${s.title}: ${s.values.length} linhas`).join("\n"));
