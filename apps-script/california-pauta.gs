/**
 * California | Creative Intelligence
 * Script único da Pauta de Criação. Faz duas coisas:
 *   1. Publica uma API de leitura protegida por token (a dashboard lê a planilha por aqui).
 *   2. Avisa a dashboard quando a planilha é editada, para a atualização chegar em segundos.
 *
 * Passo a passo completo no README (seção 3). Resumo:
 *   - Rode a função configurar() uma vez e copie os códigos do registro de execução.
 *   - Implante como App da Web (Executar como: Eu / Quem pode acessar: Qualquer pessoa).
 *   - Depois de publicar a dashboard, rode definirEnderecoDashboard() e crie os acionadores.
 */

var CI_PLANILHA_ID = '1Czltjygjb6NLeBpca4n05oZz-qfNWA0ciKPCx-eLxBY';
var CI_GUIAS_EXTRAS = ['listas', 'visao geral'];

function ciPlanilha_() {
  return SpreadsheetApp.openById(CI_PLANILHA_ID);
}

/* ---------- 1. Configuração inicial ---------- */

/** Gera e guarda os códigos secretos. Pode rodar de novo: não sobrescreve o que já existe. */
function configurar() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_TOKEN')) props.setProperty('API_TOKEN', ciGerar_());
  if (!props.getProperty('WEBHOOK_SECRET')) props.setProperty('WEBHOOK_SECRET', ciGerar_());
  // Lê a planilha uma vez para o Google pedir as autorizações agora.
  ciPlanilha_().getName();

  console.log('Copie estes valores para as variáveis do Railway:');
  console.log('APPS_SCRIPT_TOKEN = ' + props.getProperty('API_TOKEN'));
  console.log('WEBHOOK_SECRET = ' + props.getProperty('WEBHOOK_SECRET'));
  console.log('SESSION_SECRET = ' + ciGerar_());
}

/** Edite o endereço entre aspas e rode esta função depois de publicar a dashboard. */
function definirEnderecoDashboard() {
  var endereco = 'https://SEU-ENDERECO.up.railway.app';
  if (endereco.indexOf('SEU-ENDERECO') >= 0) throw new Error('Troque o endereço entre aspas antes de rodar.');
  PropertiesService.getScriptProperties().setProperty('DASHBOARD_URL', endereco.replace(/\/$/, ''));
  console.log('Endereço salvo: ' + endereco);
}

/* ---------- 2. API de leitura ---------- */

function doGet(e) {
  var esperado = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  var recebido = (e && e.parameter && e.parameter.token) || '';
  if (!esperado || esperado.length < 32 || !ciIguais_(recebido, esperado)) {
    return ciJson_({ ok: false, error: 'token inválido' });
  }

  var cache = CacheService.getScriptCache();
  var guardado = cache.get('ci-pauta');
  if (guardado) return ContentService.createTextOutput(guardado).setMimeType(ContentService.MimeType.JSON);

  var ss = ciPlanilha_();
  var sheets = ss.getSheets()
    .filter(function (sh) {
      var nome = sh.getName();
      return /\|/.test(nome) || CI_GUIAS_EXTRAS.indexOf(ciChave_(nome)) >= 0;
    })
    .map(function (sh) {
      var values = sh.getDataRange().getDisplayValues();
      return { title: sh.getName(), values: values, links: ciLinks_(sh, values) };
    });

  var corpo = JSON.stringify({ ok: true, title: ss.getName(), sheets: sheets });
  if (corpo.length < 95000) cache.put('ci-pauta', corpo, 15);
  return ContentService.createTextOutput(corpo).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 3. Aviso de edição ---------- */

/** Ligada aos acionadores "Ao editar" e "Ao alterar". */
function notificarDashboard() {
  CacheService.getScriptCache().remove('ci-pauta');
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('DASHBOARD_URL');
  var secret = props.getProperty('WEBHOOK_SECRET');
  if (!url || !secret) return;

  var cache = CacheService.getScriptCache();
  if (cache.get('ci-notificado')) return; // no máximo um aviso a cada 10 s
  cache.put('ci-notificado', '1', 10);
  try {
    UrlFetchApp.fetch(url + '/api/revalidate', {
      method: 'post',
      headers: { 'x-webhook-secret': secret },
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.warn('Falha ao avisar a dashboard: ' + err);
  }
}

/* ---------- links ---------- */

/**
 * Lê a coluna LINKS de uma guia de pauta e devolve as URLs de cada linha.
 * Funciona com link na célula inteira e com vários links no mesmo texto ("Briefing · Apresentação").
 * Resultado: { "26": [{ t: "Apresentação", u: "https://..." }], ... } com o número da linha da planilha.
 */
function ciLinks_(sh, values) {
  var hRow = -1, col = -1;
  for (var r = 0; r < Math.min(values.length, 15) && hRow < 0; r++) {
    var keys = values[r].map(ciChave_);
    if (keys.indexOf('tarefa') >= 0) {
      hRow = r;
      col = keys.indexOf('links');
      if (col < 0) col = keys.indexOf('link');
    }
  }
  if (hRow < 0 || col < 0 || values.length <= hRow + 1) return {};
  var rich = sh.getRange(hRow + 2, col + 1, values.length - hRow - 1, 1).getRichTextValues();
  var out = {};
  rich.forEach(function (row, i) {
    var rt = row[0];
    if (!rt) return;
    var items = [];
    rt.getRuns().forEach(function (run) {
      var url = run.getLinkUrl();
      if (!url) return;
      var label = run.getText().replace(/[·|]/g, ' ').replace(/\s+/g, ' ').trim();
      var last = items[items.length - 1];
      if (last && last.u === url) { last.t = (last.t + ' ' + label).trim(); return; }
      items.push({ t: label, u: url });
    });
    if (!items.length && rt.getLinkUrl()) items.push({ t: rt.getText().trim(), u: rt.getLinkUrl() });
    if (items.length) out[String(hRow + 2 + i)] = items;
  });
  return out;
}

/* ---------- utilitários ---------- */

function ciGerar_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}
function ciChave_(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function ciIguais_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function ciJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
