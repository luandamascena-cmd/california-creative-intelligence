# CALIFORNIA | CREATIVE INTELLIGENCE

Central de inteligência da Pauta de Criação do Ecossistema California. Lê a planilha **Pauta de Criação | Ecossistema California** por um Apps Script protegido por token (ou pela API oficial do Google Sheets), consolida todas as guias de time, trata os dados e apresenta indicadores, 15 visualizações interativas, drill-down, exportação e modo apresentação.

Nenhum dado fica no código. Alterar, incluir ou excluir linhas e guias na planilha atualiza a dashboard sozinha, sem novo deploy.

---

## 1. Como a planilha é interpretada

| Elemento | Origem | Regra |
|---|---|---|
| **Guias de pauta** | Nome no padrão `REGIONAL \| TIME` | Descobertas automaticamente. Uma guia nova (ex.: `BH \| California`) entra sozinha. `Visão Geral`, `Listas` e `Links Úteis` não são pauta. |
| **Cabeçalho** | Linha com a coluna `TAREFA` | Procurado nas 15 primeiras linhas (hoje está na linha 4). Colunas reconhecidas por nome, não por posição. |
| **Regional** | Primeira parte do nome da guia | SP, RJ, NO, NE. |
| **Time** | Segunda parte do nome da guia | Time executor (California, Content House). |
| **Business Unit** | Coluna `BUSINESS UNIT` | BU a que a demanda pertence. **Não é a mesma coisa que o time**: a guia SP \| Content House atende seis BUs. |
| **Demanda** | Cada linha preenchida | Unidade de todas as contagens. |
| **Projeto** | Coluna `PROJETO`, se existir | Sem essa coluna, é estimado: mesmo cliente + mesmo nome de tarefa, ignorando prefixos `[...]`, versões (V2, V3) e idioma (ENG, Inglês). |
| **Responsáveis** | `PLANEJAMENTO` e `DIRETOR DE ARTE` | Células com várias pessoas são separadas por vírgula, ponto e vírgula ou barra. |
| **Grafias oficiais** | Guia `Listas` | Cliente, pessoa, formato, BU, status, prioridade e tipo são padronizados pela lista (acentos, maiúsculas e espaços). Valores fora da lista são sinalizados. |

### Métricas que a planilha permite calcular com segurança
Demandas, clientes, colaboradores, BUs, regionais e times ativos; distribuição por status, formato, prioridade e tipo de projeto; abertas, travadas, atrasadas (ENTREGA anterior a hoje) e com entrega em 7 dias; entradas por período (INÍCIO); entregas previstas por período (ENTREGA); prazo planejado mediano.

### O que a planilha não permite (e a dashboard não inventa)
- **Projetos exatos**: falta a coluna `PROJETO`. A contagem atual é marcada como estimativa.
- **Entregas no prazo e tempo de execução**: falta a data de conclusão. `ENTREGA` é tratada como prazo planejado.
- **Capacidade individual**: não há horas ou esforço; a carga por pessoa mostra concentração, não sobrecarga.
- **Comparação com períodos anteriores**: não há histórico de snapshots; a comparação usa as datas de INÍCIO (entradas nos últimos 30 dias contra os 30 anteriores).

Para destravar as três primeiras, basta criar as colunas `PROJETO` e `CONCLUSÃO` nas guias. A dashboard reconhece e passa a usá-las automaticamente.

### Conferência
Os números são conferidos a cada sincronização contra o quadro **Por time** da guia Visão Geral (Tarefas, Ativas, Atrasadas, Em 7 dias). O resultado aparece em **Qualidade dos dados**. No snapshot de 14/10/2026, todos os valores batem: 94 tarefas, 23 ativas, 6 atrasadas, 3 em 7 dias.

---

## 2. Arquitetura

```
Navegador (React, ECharts)
  │  a cada REFRESH_SECONDS, só baixa a base se a versão mudou
  ▼
middleware.ts ── valida a sessão (cookie httpOnly assinado) em toda rota
  ▼
/api/data ── lib/data-service.ts ── cache compartilhado (CACHE_TTL_SECONDS)
                     │
                     ├─ lib/google.ts      Apps Script (1 chamada) ou Sheets API (metadados + batchGet)
                     └─ lib/normalize.ts   tratamento, padronização, duplicatas, projetos, qualidade, conferência
/api/revalidate ◄── Google Apps Script (ao editar) invalida o cache
/api/auth/login  ── senha validada no servidor, com limite de tentativas
```

- **Stack**: Next.js 15 (App Router) + TypeScript, Tailwind CSS, Apache ECharts (heatmap, calendário e matrizes que o Recharts não oferece nativamente), Motion, Lucide, jose.
- **shadcn/ui**: os componentes foram escritos no mesmo padrão (Tailwind + primitivas acessíveis), sem a CLI, para manter o pacote enxuto e a identidade da California.
- **Segurança**: token do Apps Script, credenciais do Google e senha só existem em variáveis de ambiente do servidor; leitura somente; sessões JWT de 12 h em cookie httpOnly; limite de 8 tentativas de senha a cada 10 min; leitura forçada limitada a 1 a cada 10 s.
- **Cotas**: com cache de 30 s, a planilha é lida no máximo duas vezes por minuto, independente do número de pessoas com a dashboard aberta.

---

## 3. Conectar a planilha

Existem dois caminhos. Ambos são somente leitura e mantêm as credenciais no servidor.

### Opção 1 (recomendada): Apps Script da própria planilha, sem Google Cloud

A planilha publica uma pequena API protegida por token, que roda com a sua conta Google. Nenhum projeto no Google Cloud é necessário.

1. Na planilha: **Extensões > Apps Script**. Cole o conteúdo de `apps-script/california-pauta.gs` e rode a função `configurar()`, que gera e guarda os códigos.
2. Copie do registro de execução os valores de `APPS_SCRIPT_TOKEN`, `WEBHOOK_SECRET` e `SESSION_SECRET`.
3. **Implantar > Nova implantação > App da Web**, com "Executar como: Eu" e "Quem pode acessar: Qualquer pessoa". Autorize e copie a URL terminada em `/exec`.
4. No servidor, preencha `APPS_SCRIPT_URL` (a URL) e `APPS_SCRIPT_TOKEN`.

"Qualquer pessoa" apenas dispensa o login do Google na URL; sem o token, o script não devolve dado algum. Para trocar o token, altere nos dois lugares.

Limites a conhecer: o script lê com as permissões de quem o implantou (se essa pessoa perder acesso à planilha, a dashboard para), e cada leitura leva cerca de 1 a 3 segundos, o que é irrelevante com o cache do servidor.

### Opção 2: conta de serviço do Google Cloud

Indicada se a TI preferir uma credencial técnica, que não dependa de um usuário.

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative a **Google Sheets API**.
2. Crie uma **conta de serviço**, gere uma chave **JSON** e compartilhe a planilha com o `client_email` como **Leitor**.
3. Preencha `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_PRIVATE_KEY`.

Se `APPS_SCRIPT_URL` estiver preenchida, ela tem prioridade.

---

## 4. Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
```

Sem credenciais, use `DATA_SOURCE=demo` para ver a interface com o snapshot da planilha (uma faixa amarela identifica o modo demonstração).

Conferir os cálculos contra a Visão Geral do snapshot: `npm run check:data`.

---

## 5. Publicar no Railway

1. Suba esta pasta para um repositório no GitHub.
2. No Railway: **New Project > Deploy from GitHub repo** e escolha o repositório. O Nixpacks detecta Next.js e usa `npm run build` e `npm start`; a porta vem da variável `PORT`, que o Railway define sozinho.
3. Em **Variables**, cadastre: `APPS_SCRIPT_URL`, `APPS_SCRIPT_TOKEN`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`, `WEBHOOK_SECRET` e, se quiser, `REFRESH_SECONDS` e `CACHE_TTL_SECONDS`.
4. Em **Settings > Networking**, gere um domínio público (ou conecte um domínio próprio).
5. Acesse a URL e entre com `DASHBOARD_PASSWORD`.

O Railway mantém uma instância sempre ativa, o que favorece este projeto: o cache e o aviso do Apps Script valem para todos os acessos ao mesmo tempo.

A aplicação também roda na Vercel, no Render ou em qualquer servidor Node 18+ com `npm run build && npm start`.

## 6. Atualização em tempo quase real (Apps Script)

A dashboard já sincroniza sozinha a cada `REFRESH_SECONDS`. Para que uma edição apareça sem esperar o cache, rode `definirEnderecoDashboard()` no mesmo script e crie dois acionadores para `notificarDashboard` (Da planilha: Ao editar e Ao alterar). Ele chama `/api/revalidate` ao editar, com no máximo um aviso a cada 10 s.

---

## 7. Uso

- **Navegação**: Visão Geral (todas as guias) ou regional; dentro da regional, filtro por time. Regionais e times vêm da planilha.
- **Filtros combinados**: BU, cliente, colaborador, formato, status, prioridade, tipo de projeto e período (por INÍCIO ou ENTREGA). Ficam na URL, então um link compartilhado abre no mesmo recorte.
- **Drill-down**: clique em qualquer barra, fatia, célula, ponto ou indicador para ver os registros, com origem (guia e linha). "Aplicar como filtro" leva o recorte para a dashboard inteira.
- **Busca global**: `Ctrl/⌘ + K`.
- **Exportação**: PNG por gráfico, CSV dos dados filtrados (ou de um drill-down), PDF pelo botão PDF (impressão em A3 paisagem).
- **Modo apresentação**: tela cheia sem menus, com rotação opcional entre Visão Geral e regionais a cada 30 s, para TVs de acompanhamento da pauta.
- **Acessibilidade**: cada gráfico tem visão em tabela, descrição para leitores de tela, navegação por teclado e respeita "reduzir movimento". Paletas validadas para daltonismo sobre o fundo escuro.

## 8. Manutenção

| Quero... | Onde |
|---|---|
| Adicionar um time | Duplique uma guia de pauta e renomeie no padrão `REGIONAL \| TIME`. Nada no código. |
| Mudar cores de status ou BU | `components/theme.ts` |
| Ajustar regras de projeto, duplicata ou status | `lib/normalize.ts` |
| Incluir um gráfico | `components/charts/` e a grade em `components/Dashboard.tsx` |
| Trocar a senha | Variável `DASHBOARD_PASSWORD` no Railway (reinicia sozinho) |
