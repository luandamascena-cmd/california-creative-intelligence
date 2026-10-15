// Na inicialização do servidor, faz a primeira leitura da planilha e registra o resultado nos logs.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
