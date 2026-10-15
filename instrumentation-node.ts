import { getDataset } from "./lib/data-service";

getDataset()
  .then((r) => {
    if (r.ok && r.data) {
      console.log(`[sync] conectado (${r.data.source}): ${r.data.demands.length} demandas em ${r.data.tabs.length} guias, ${r.data.issues.length} avisos de qualidade`);
    } else {
      console.error(`[sync] falha na primeira leitura: ${r.error}`);
    }
  })
  .catch((e) => console.error(`[sync] falha na primeira leitura: ${e}`));
