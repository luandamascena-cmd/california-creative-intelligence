// Na inicialização do servidor, faz a primeira leitura da planilha e registra o resultado nos logs.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDataset } = await import("./lib/data-service");
  const r = await getDataset().catch((e) => ({ ok: false as const, error: String(e), data: undefined }));
  if (r.ok && r.data) {
    console.log(`[sync] conectado (${r.data.source}): ${r.data.demands.length} demandas em ${r.data.tabs.length} guias, ${r.data.issues.length} avisos de qualidade`);
  } else {
    console.error(`[sync] falha na primeira leitura: ${r.error}`);
  }
}
