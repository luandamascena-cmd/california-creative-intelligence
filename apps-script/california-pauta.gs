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
      return { title: sh.getName(), values: sh.getDataRange().getDisplayValues() };
    });

  var corpo = JSON.stringify({ ok: true, title: ss.getName(), sheets: sheets });
  if (corpo.length < 90000) cache.put('ci-pauta', corpo, 15);
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
