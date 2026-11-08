/* =========================================================
   CAMADA DE DADOS (CRUD)
   ---------------------------------------------------------
   Todos os registros (loja, usuários, clientes e lançamentos)
   ficam numa única aba do Google Sheets chamada "registros":

     id | tabela | dados (JSON do registro) | atualizado_em

   Modos (escolha em config.js):
     'local'  -> salva no navegador (para testar)
     'sheets' -> Google Planilhas via Apps Script (um único link /exec)
     'make'   -> um cenário do Make por operação:
                 Create -> CRUD-Create-Registro  (Add a Row)
                 Read   -> CRUD-Read-Registros   (Search Rows + Text Aggregator)
                 Update -> CRUD-Update-Registro  (Search Rows + Update a Row)
                 Delete -> CRUD-Delete-Registro  (Search Rows + Delete a Row)
   ========================================================= */
const API = (() => {
  const CHAVE_LOCAL = 'caderneta_db_v1';
  let registros = [];          // cópia em memória de tudo que veio do banco
  let ultimaLeitura = 0;

  const modoMake = () => CONFIG.MODO === 'make';
  const modoSheets = () => CONFIG.MODO === 'sheets';
  const remoto = () => modoMake() || modoSheets();

  function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Modo local (localStorage) ---------- */
  function lerLocal() {
    try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL)) || []; }
    catch { return []; }
  }
  function salvarLocal() {
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(registros)); }
    catch (e) { console.warn('Não foi possível salvar localmente', e); }
  }

  /* ---------- Modo Make (webhooks) ---------- */
  // Envia como formulário (application/x-www-form-urlencoded):
  // é uma "requisição simples", então o navegador não faz preflight CORS.
  async function chamarMake(operacao, campos) {
    const url = CONFIG.WEBHOOKS[operacao];
    if (!url || url.includes('COLE_AQUI')) {
      throw new Error(`Webhook "${operacao}" não configurado em config.js`);
    }
    let resposta;
    try {
      resposta = await fetch(url, { method: 'POST', body: new URLSearchParams(campos) });
    } catch {
      throw new Error('Sem conexão com o Make. Verifique a internet e se o cenário está ativo.');
    }
    if (!resposta.ok) throw new Error(`O Make respondeu com erro (${resposta.status}) na operação ${operacao}.`);
    return resposta.text();
  }

  /* ---------- Modo Google Planilhas (Apps Script) ---------- */
  // Um único link (/exec). A operação vai no campo "operacao".
  async function chamarSheets(operacao, campos) {
    const url = CONFIG.URL_APPS_SCRIPT;
    if (!url || url.includes('COLE_AQUI')) throw new Error('Link do Apps Script não configurado em config.js');
    let resposta;
    try {
      resposta = await fetch(url, { method: 'POST', body: new URLSearchParams({ operacao, ...campos }) });
    } catch {
      throw new Error('Sem conexão com a planilha. Verifique a internet e se o Apps Script foi implantado para "Qualquer pessoa".');
    }
    if (!resposta.ok) throw new Error(`A planilha respondeu com erro (${resposta.status}) na operação ${operacao}.`);
    const texto = await resposta.text();
    let json;
    try { json = JSON.parse(texto); }
    catch { throw new Error('O link do Apps Script não respondeu como esperado. Confira se é o link que termina em /exec.'); }
    if (json && json.ok === false) throw new Error(`Erro na planilha: ${json.erro || 'desconhecido'}`);
    return texto;
  }

  const chamar = (operacao, campos) => (modoSheets() ? chamarSheets(operacao, campos) : chamarMake(operacao, campos));

  /* ---------- READ ---------- */
  async function carregar() {
    if (remoto()) {
      const texto = await chamar('read', { operacao: 'read' });
      let lista = [];
      try { lista = JSON.parse(texto); } catch { lista = []; }
      registros = (Array.isArray(lista) ? lista : [])
        .filter(r => r && r.id && r.tabela && !String(r.tabela).startsWith('_'));
    } else {
      registros = lerLocal();
    }
    ultimaLeitura = Date.now();
    return registros;
  }

  const listar = tabela => registros.filter(r => r.tabela === tabela);
  const obter = id => registros.find(r => r.id === id) || null;

  /* ---------- CREATE ---------- */
  async function criar(tabela, dados) {
    const agora = new Date().toISOString();
    const registro = { ...dados, id: gerarId(), tabela, criado_em: agora, atualizado_em: agora };
    if (remoto()) {
      await chamar('create', { id: registro.id, tabela, dados: JSON.stringify(registro) });
    }
    registros.push(registro);
    if (!remoto()) salvarLocal();
    return registro;
  }

  /* ---------- UPDATE ---------- */
  async function atualizar(id, mudancas) {
    const atual = obter(id);
    if (!atual) throw new Error('Registro não encontrado. Toque em atualizar e tente de novo.');
    const registro = { ...atual, ...mudancas, id, tabela: atual.tabela, atualizado_em: new Date().toISOString() };
    if (remoto()) {
      await chamar('update', { id, tabela: registro.tabela, dados: JSON.stringify(registro) });
    }
    registros = registros.map(r => (r.id === id ? registro : r));
    if (!remoto()) salvarLocal();
    return registro;
  }

  /* ---------- DELETE ---------- */
  async function excluir(id) {
    if (remoto()) await chamar('delete', { id });
    registros = registros.filter(r => r.id !== id);
    if (!remoto()) salvarLocal();
  }

  return {
    carregar, listar, obter, criar, atualizar, excluir,
    get ultimaLeitura() { return ultimaLeitura; },
    // "Impressão digital" dos dados: muda quando algo é criado, editado ou excluído
    assinatura: () => registros.map(r => `${r.id}:${r.atualizado_em}`).sort().join('|'),
    CHAVE_LOCAL,
    get modo() { return modoSheets() ? 'Google Planilhas (Apps Script)' : modoMake() ? 'Make + Google Sheets' : 'Local (navegador)'; }
  };
})();
