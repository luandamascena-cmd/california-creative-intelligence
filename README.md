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
- **Entregas no prazo e tempo de execução**: a pauta não registra data de conclusão (decisão do time). `ENTREGA` é tratada como prazo planejado.
- **Capacidade individual**: não há horas ou esforço; a carga por pessoa mostra concentração, não sobrecarga.
- **Comparação com períodos anteriores**: não há histórico de snapshots; a comparação usa as datas de INÍCIO (entradas nos últimos 30 dias contra os 30 anteriores).

Para tornar a contagem de projetos exata, basta criar a coluna `PROJETO` nas guias. A dashboard reconhece e passa a usá-la automaticamente.

### Links
A coluna `LINKS` de cada guia aparece no painel de detalhes de cada demanda, como botões que abrem em nova aba. O Apps Script lê os links embutidos no texto da célula (um ou vários por célula, ex.: "Briefing · Apresentação"). Só endereços `http` e `https` são exibidos. Na leitura pela conta de serviço do Google Cloud, apenas URLs digitadas por extenso na célula são reconhecidas.

### Qualidade dos dados
Toda divergência aponta a guia (por extenso) e a linha da planilha, no formato `(guia São Paulo · Content House, linha 26)`. Alertas já verificados pelo time podem ser silenciados em `lib/quality-rules.ts` (ex.: demandas homônimas confirmadas como diferentes). No mesmo arquivo, `NOT_CREATIVE_TEAM` lista quem aparece na pauta mas não é da equipe de criação (hoje Louis Millard e Carolina Barakat): essas pessoas ficam fora de todas as contagens.

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
3. Em **Variables**, cadastre: `APPS_SCRIPT_URL`, `APPS_SCRIPT_TOKEN`, `DASHBOARD_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `WEBHOOK_SECRET`, `LAYOUT_FILE=/data/layout.json` e, se quiser, `REFRESH_SECONDS` e `CACHE_TTL_SECONDS`. Crie um volume montado em `/data` para o layout sobreviver a novos deploys.
4. Em **Settings > Networking**, gere um domínio público (ou conecte um domínio próprio).
5. Acesse a URL e entre com `DASHBOARD_PASSWORD`.

O Railway mantém uma instância sempre ativa, o que favorece este projeto: o cache e o aviso do Apps Script valem para todos os acessos ao mesmo tempo.

A aplicação também roda na Vercel, no Render ou em qualquer servidor Node 18+ com `npm run build && npm start`.

## 6. Atualização em tempo quase real (Apps Script)

A dashboard já sincroniza sozinha a cada `REFRESH_SECONDS`. Para que uma edição apareça sem esperar o cache, rode `definirEnderecoDashboard()` no mesmo script e crie dois acionadores para `notificarDashboard` (Da planilha: Ao editar e Ao alterar). Ele chama `/api/revalidate` ao editar, com no máximo um aviso a cada 10 s.

---

## 7. Uso

- **Central**: mapa do Brasil com as regionais. Só o círculo do urso é clicável. Regionais com mais de um time (hoje São Paulo, Fortaleza e Salvador) abrem uma página própria, com fotos da cidade desfocadas ao fundo, o mapa do estado (sem clique no urso), a Visão Geral da regional, o termômetro por time e a escolha entre California e Content House. Regionais com um único time vão direto para a dashboard.
- **Panorama** (menu lateral ou central): página longa só com as regionais. Cada regional abre com uma faixa de largura total, com a foto da cidade desfocada atrás do nome centralizado; dentro dela, um bloco enxuto por time: Projetos, Status e Insights na mesma linha, Clientes em Pauta, e Demandas por Colaboradores (as demandas abrem abaixo ao clicar numa pessoa) ao lado do Top 10 Clientes. O Panorama não usa o layout personalizado da dashboard.
- **Layout personalizado** (somente administrador): entre com `ADMIN_PASSWORD` e use Personalizar para arrastar, mudar a largura, trocar o tipo (barras, rosca, ranking, tabela), remover ou adicionar gráficos. "Salvar para todos" grava o layout no servidor (`LAYOUT_FILE`, no volume `/data` do Railway) e todos os acessos passam a ver a mesma arrumação.; "Restaurar padrão" volta à arrumação original.
- **Navegação**: Visão Geral (todas as guias) ou regional; dentro da regional, filtro por time. Regionais e times vêm da planilha. O menu lateral recolhe pela alça na borda (ou por Recolher) e mostra as siglas SP, RJ, FOR e SSA.
- **Filtros**: Business Unit, cliente e período ficam fixos no topo, com o valor escolhido dentro do próprio seletor. Toda dashboard abre nos **últimos 30 dias**; o período pode ser trocado por semana, mês, bimestre, trimestre, semestre, ano ou todo o período. Colaborador, formato, status, prioridade e tipo entram pelo "Aplicar como filtro" do drill-down e aparecem como etiquetas removíveis. Os filtros ficam na URL, então um link compartilhado abre no mesmo recorte.
- **Abertura**: o número de projetos, o status das demandas em formato compacto e os insights do recorte (volume, formatos, clientes, Business Units e novos negócios; prazos e travas ficam no status).
- **Clientes em Pauta**: faixa abaixo da abertura, em toda dashboard e em cada seção do Panorama, com os clientes que têm demandas abertas no recorte (logo redondo, número de abertas e de vencidas). Clicar no logo abre a lista das demandas logo abaixo. Cada cliente aparece com o logo em branco sobre a cor da marca; as marcas do ecossistema California (BUs e IPs) ficam padronizadas em branco sobre preto. Logos ficam em `public/brand/clientes/<slug>.png` (PNG quadrado de 320 px, logo branco com fundo transparente) e cor, logo e marca da casa são definidos em `CLIENT_BRANDS`, em `lib/clients.ts`. Cliente sem logo aparece com o nome em tipografia sobre a cor da marca.
- **Colaboradores**: em Demandas por Colaboradores, cada pessoa aparece em um círculo com foto (ou iniciais) e o número de demandas abertas; clicar na foto mostra as demandas ao lado. As fotos vêm do perfil do e-mail corporativo: o Apps Script lê o diretório do Google Workspace (serviço avançado People API, função `ciPessoas_`) e a dashboard liga cada nome da pauta à pessoa certa (`matchDirectoryPhotos` em `lib/people.ts`, que só aceita correspondência única). Para sobrescrever uma foto, salve em `public/brand/pessoas/<slug>.webp` e liste em `PEOPLE_PHOTOS`. Em Projetos por Colaboradores, clicar em um nome mostra as demandas daquela pessoa ao lado do gráfico (vencidas primeiro), com status, prazo e links.
- **Drill-down**: clique em qualquer barra, fatia, célula, ponto ou indicador para ver os registros, com origem (guia e linha). "Aplicar como filtro" leva o recorte para a dashboard inteira.
- **Busca global**: `Ctrl/⌘ + K`.
- **Exportação**: PNG por gráfico, CSV dos dados filtrados (ou de um drill-down), PDF pelo botão PDF (impressão em A3 paisagem).
- **Modo apresentação**: tela cheia sem menus, com rotação opcional entre Visão Geral e regionais a cada 30 s, para TVs de acompanhamento da pauta.
- **Acessibilidade**: cada gráfico tem visão em tabela, descrição para leitores de tela, navegação por teclado e respeita "reduzir movimento". Paletas validadas para daltonismo sobre o fundo escuro.

## 8. Manutenção

| Quero... | Onde |
|---|---|
| Adicionar um time | Duplique uma guia de pauta e renomeie no padrão `REGIONAL \| TIME`. Nada no código. |
| Adicionar uma regional ao mapa | Sede, sigla e estado em `lib/regions.ts`; contorno do estado em `scripts/data/estados.geojson`; depois `npm run map`. |
| Fotos de fundo da página de uma regional | Campo `photos` da regional em `lib/regions.ts` (arquivos em `public/brand/`). |
| Logo ou cor de um cliente | `CLIENT_BRANDS` em `lib/clients.ts` (arquivo em `public/brand/clientes/`). |
| Logo de um time novo | `TEAM_LOGOS` em `components/RegionHub.tsx` (arquivo em `public/brand/`). |
| Mudar cores de status ou BU | `components/theme.ts` |
| Ajustar regras de projeto, duplicata ou status | `lib/normalize.ts` |
| Incluir um gráfico | `components/charts/` e a grade em `components/Dashboard.tsx` |
| Trocar a senha | Variável `DASHBOARD_PASSWORD` no Railway (reinicia sozinho) |
| Trocar a senha de administrador | Variável `ADMIN_PASSWORD` no Railway |
