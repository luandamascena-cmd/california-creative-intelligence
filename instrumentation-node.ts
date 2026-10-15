import { getDataset } from "./lib/data-service";

getDataset()
  .then((r) => {
    if (!(r.ok && r.data)) {
      console.error(`[sync] falha na primeira leitura: ${r.error}`);
    }
  })
  .catch((e) => console.error(`[sync] falha na primeira leitura: ${e}`));
