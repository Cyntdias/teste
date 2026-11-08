/* =========================================================
   Caderneta — Controle de Fiado
   Lógica das telas, regras de negócio e navegação.
   ========================================================= */
'use strict';

/* ===================== Utilidades ===================== */
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const conteudo = $('#conteudo');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arred = n => Math.round((Number(n) || 0) * 100) / 100;
const somar = (lista, f = x => x) => arred(lista.reduce((s, x) => s + (Number(f(x)) || 0), 0));
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const soDigitos = s => String(s ?? '').replace(/\D/g, '');
const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const iniciais = nome => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/* Datas sempre no formato AAAA-MM-DD (fuso local) */
function isoDe(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const hojeISO = () => isoDe(new Date());
function somarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  return isoDe(new Date(a, m - 1, d + n));
}
function difDias(de, ate) {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}
const dataBR = iso => (iso ? iso.split('-').reverse().join('/') : '—');
function nomeMes(mesISO) {
  const [a, m] = mesISO.split('-').map(Number);
  const texto = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
function mudarMes(mesISO, delta) {
  const [a, m] = mesISO.split('-').map(Number);
  return isoDe(new Date(a, m - 1 + delta, 1)).slice(0, 7);
}
function textoPrazo(venc) {
  const d = difDias(hojeISO(), venc);
  if (d === 0) return 'vence hoje';
  if (d === 1) return 'vence amanhã';
  if (d > 1) return `vence em ${d} dias`;
  if (d === -1) return 'venceu ontem';
  return `venceu há ${-d} dias`;
}

/* Dinheiro: aceita "1.234,56", "1234,56" e "1234.56" */
function lerValor(texto) {
  let s = String(texto ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? arred(n) : NaN;
}
const valorParaCampo = v => (v || v === 0 ? Number(v).toFixed(2).replace('.', ',') : '');

/* Telefone (obrigatório no cliente) */
function formatarTelefone(t) {
  const d = soDigitos(t);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t || '';
}
const telefoneValido = t => /^[1-9]{2}\d{8,9}$/.test(soDigitos(t));
function mascararTelefone(input) {
  input.addEventListener('input', () => {
    const d = soDigitos(input.value).slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 6) {
      const meio = d.length === 11 ? 7 : 6;
      v = `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
    }
    input.value = v;
  });
}
function linkWhatsApp(telefone, mensagem) {
  let d = soDigitos(telefone);
  if (d.length <= 11) d = CONFIG.DDI_WHATSAPP + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`;
}

/* Senha: guardamos apenas um "hash" com sal, nunca a senha em texto puro */
function hashTexto(str, semente = 0) {
  let h1 = 0xdeadbeef ^ semente, h2 = 0x41c6ce57 ^ semente;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
const hashPin = (pin, sal) => hashTexto(`${sal}:${pin}`, 7) + hashTexto(`${pin}:${sal}`, 13);
const novoSal = () => Math.random().toString(36).slice(2, 10);

/* ===================== Ícones (SVG) ===================== */
const svg = (d, t = 24) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  casa: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  pessoas: svg('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>'),
  sino: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  grafico: svg('<path d="M3 3v18h18M7 15v3M12 10v8M17 6v12"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  mais: svg('<path d="M12 5v14M5 12h14"/>', 22),
  busca: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 20),
  compra: svg('<path d="M6 7h12l1 14H5zM9 7a3 3 0 0 1 6 0"/>', 20),
  pagamento: svg('<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>', 20),
  whats: svg('<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3zM9 10h.01M12 10h.01M15 10h.01"/>', 20),
  telefone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', 20),
  loja: svg('<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>', 22),
  sair: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', 22),
  instalar: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', 22),
  imprimir: svg('<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z"/>', 20),
  dir: svg('<path d="m9 18 6-6-6-6"/>', 20),
  esq: svg('<path d="m15 18-6-6 6-6"/>', 22),
  dirG: svg('<path d="m9 18 6-6-6-6"/>', 22),
  alerta: svg('<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0"/>', 20),
  relogio: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 20),
  atualizar: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', 22),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 18),
  caderno: svg('<path d="M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5zM9 3v18M12 8h4M12 12h4"/>', 48)
};

/* ===================== Estado e permissões ===================== */
const CHAVE_SESSAO = 'caderneta_sessao';
const estado = { usuario: null, filtroClientes: 'todos', buscaClientes: '', mesRelatorio: null };
let promptInstalacao = null;

const PERMISSOES = [
  { chave: 'clientes_ver',       nome: 'Ver clientes e saldos' },
  { chave: 'clientes_criar',     nome: 'Cadastrar clientes' },
  { chave: 'clientes_editar',    nome: 'Editar clientes' },
  { chave: 'clientes_excluir',   nome: 'Excluir clientes' },
  { chave: 'compras_lancar',     nome: 'Lançar compras no fiado' },
  { chave: 'pagamentos_lancar',  nome: 'Registrar pagamentos' },
  { chave: 'lancamentos_editar', nome: 'Editar e excluir lançamentos' },
  { chave: 'avisos_ver',         nome: 'Ver avisos de vencimento' },
  { chave: 'relatorios_ver',     nome: 'Ver painel de recebimentos' },
  { chave: 'equipe_gerenciar',   nome: 'Gerenciar funcionários' },
  { chave: 'loja_editar',        nome: 'Editar dados da loja' }
];
const PERMISSOES_PADRAO = ['clientes_ver', 'clientes_criar', 'compras_lancar', 'pagamentos_lancar', 'avisos_ver'];
const FORMAS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Outro'];

const loja = () => API.listar('loja')[0] || null;
const usuarios = () => API.listar('usuario');
const funcionarios = () => usuarios().filter(u => u.papel !== 'dono');
const diasAviso = () => Number(loja()?.dias_aviso ?? 3);
const pendentes = () => funcionarios().filter(u => u.pendente);

function pode(permissao) {
  const u = estado.usuario;
  if (!u) return false;
  if (u.papel === 'dono') return true;
  return Array.isArray(u.permissoes) && u.permissoes.includes(permissao);
}

/* ===================== Regras financeiras ===================== */
/* Saldo = compras − pagamentos.
   1º) Pagamentos de "Dar baixa" (com compra_id) quitam a compra escolhida.
   2º) Pagamentos avulsos (e sobras) quitam as compras que vencem antes (FIFO).
   O que sobra de cada compra fica "em aberto". */
function situacao(clienteId, lancamentos) {
  const lancs = lancamentos || API.listar('lancamento').filter(l => l.cliente_id === clienteId);
  const compras = lancs.filter(l => l.tipo === 'compra')
    .sort((a, b) => (a.vencimento || a.data).localeCompare(b.vencimento || b.data) ||
                    String(a.criado_em).localeCompare(String(b.criado_em)));
  const pagamentos = lancs.filter(l => l.tipo === 'pagamento');
  const totalCompras = somar(compras, l => l.valor);
  const totalPago = somar(pagamentos, l => l.valor);

  // Separa o que foi baixa de uma compra específica do que foi pagamento avulso
  const idsCompras = new Set(compras.map(c => c.id));
  const vinculado = {};
  let credito = 0;
  for (const p of pagamentos) {
    if (p.compra_id && idsCompras.has(p.compra_id)) vinculado[p.compra_id] = arred((vinculado[p.compra_id] || 0) + Number(p.valor));
    else credito = arred(credito + Number(p.valor));
  }
  const restos = compras.map(c => {
    const valor = arred(c.valor);
    const pagoDireto = vinculado[c.id] || 0;
    const abatido = Math.min(valor, pagoDireto);
    credito = arred(credito + pagoDireto - abatido); // sobra da baixa vira crédito
    return { compra: c, restante: arred(valor - abatido) };
  });
  const abertas = [];
  for (const r of restos) {
    const abatido = Math.min(r.restante, credito);
    credito = arred(credito - abatido);
    const restante = arred(r.restante - abatido);
    if (restante > 0) abertas.push({ ...r.compra, restante });
  }
  const hoje = hojeISO();
  const vencidas = abertas.filter(c => c.vencimento && c.vencimento < hoje);
  const aVencer = abertas.filter(c => c.vencimento && c.vencimento >= hoje && difDias(hoje, c.vencimento) <= diasAviso());
  return {
    lancs, totalCompras, totalPago, abertas, vencidas, aVencer,
    saldo: arred(totalCompras - totalPago),
    valorVencido: somar(vencidas, c => c.restante),
    valorAVencer: somar(aVencer, c => c.restante),
    proximoVencimento: abertas.map(c => c.vencimento).filter(Boolean).sort()[0] || null
  };
}

function resumoGeral() {
  const porCliente = {};
  for (const l of API.listar('lancamento')) (porCliente[l.cliente_id] ||= []).push(l);
  return API.listar('cliente').map(cliente => ({ cliente, ...situacao(cliente.id, porCliente[cliente.id] || []) }));
}

function contarAvisos() {
  return resumoGeral().filter(g => g.valorVencido > 0 || g.valorAVencer > 0).length;
}

/* ===================== Feedback (toast, carregando, modal) ===================== */
function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  const pilha = $('#toasts');
  pilha.appendChild(el);
  while (pilha.children.length > 2) pilha.firstElementChild.remove();
  setTimeout(() => el.remove(), 3500);
}

let carregamentos = 0;
function carregando(ligar) {
  carregamentos = Math.max(0, carregamentos + (ligar ? 1 : -1));
  $('#carregando').hidden = carregamentos === 0;
}

/* Executa uma operação no banco mostrando o carregamento.
   Retorna true se deu certo, false se deu erro (e mostra o erro). */
async function executar(operacao) {
  carregando(true);
  try { await operacao(); return true; }
  catch (e) { console.error(e); toast(e.message || 'Algo deu errado. Tente novamente.', 'erro'); return false; }
  finally { carregando(false); }
}

function abrirModal({ titulo, mensagem, botoes }) {
  return new Promise(resolve => {
    const fundo = $('#modal');
    fundo.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-titulo" aria-describedby="modal-msg">
        <h3 id="modal-titulo">${esc(titulo)}</h3>
        <p id="modal-msg">${esc(mensagem)}</p>
        <div class="acoes">${botoes.map((b, i) => `<button class="btn ${b.classe}" data-i="${i}">${esc(b.texto)}</button>`).join('')}</div>
      </div>`;
    fundo.hidden = false;
    const fechar = valor => {
      fundo.hidden = true; fundo.innerHTML = '';
      document.removeEventListener('keydown', tecla);
      resolve(valor);
    };
    const tecla = e => { if (e.key === 'Escape') fechar(false); };
    document.addEventListener('keydown', tecla);
    fundo.onclick = e => {
      const b = e.target.closest('[data-i]');
      if (b) fechar(botoes[b.dataset.i].valor);
      else if (e.target === fundo) fechar(false);
    };
    $$('[data-i]', fundo).pop().focus();
  });
}
const confirmar = ({ titulo, mensagem, ok = 'Confirmar', perigo = false }) => abrirModal({
  titulo, mensagem,
  botoes: [
    { texto: 'Cancelar', classe: 'btn-secundario', valor: false },
    { texto: ok, classe: perigo ? 'btn-perigo' : 'btn-primario', valor: true }
  ]
});
const informar = (titulo, mensagem) => abrirModal({
  titulo, mensagem, botoes: [{ texto: 'Entendi', classe: 'btn-primario', valor: true }]
});

/* ===================== Formulários ===================== */
function campo({ rotulo, nome, tipo = 'text', valor = '', obrig = false, attrs = '', dica = '', prefixo = '' }) {
  const id = `f-${nome}`;
  const input = `<input id="${id}" name="${nome}" type="${tipo}" value="${esc(valor)}" ${attrs}>`;
  return `
    <div class="campo">
      <label for="${id}">${esc(rotulo)}${obrig ? ' <span class="obrigatorio" aria-label="obrigatório">*</span>' : ''}</label>
      ${prefixo ? `<div class="prefixo"><span>${prefixo}</span>${input}</div>` : input}
      ${dica ? `<div class="dica">${esc(dica)}</div>` : ''}
      <div class="erro" role="alert"></div>
    </div>`;
}
const campoValor = (rotulo, nome, valor) =>
  campo({ rotulo, nome, valor: valorParaCampo(valor), obrig: true, prefixo: 'R$', attrs: 'inputmode="decimal" autocomplete="off" placeholder="0,00"' });

function lerFormulario(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
}
/* Mostra os erros embaixo de cada campo. Retorna true se não houver erros. */
function mostrarErros(form, erros) {
  $$('.campo', form).forEach(c => { c.classList.remove('invalido'); const e = $('.erro', c); if (e) e.textContent = ''; });
  const nomes = Object.keys(erros);
  for (const nome of nomes) {
    const c = form.querySelector(`[name="${nome}"]`)?.closest('.campo');
    if (!c) continue;
    c.classList.add('invalido');
    $('.erro', c).textContent = erros[nome];
  }
  if (nomes.length) form.querySelector(`[name="${nomes[0]}"]`)?.focus();
  return nomes.length === 0;
}
function prepararCamposValor(form) {
  $$('input[inputmode="decimal"]', form).forEach(i => i.addEventListener('blur', () => {
    const v = lerValor(i.value);
    if (Number.isFinite(v)) i.value = valorParaCampo(v);
  }));
}

/* ===================== Estrutura das telas ===================== */
function definirTopo(titulo, voltarPara = null) {
  $('#topo').hidden = false;
  $('#titulo').textContent = titulo;
  const voltar = $('#btn-voltar');
  voltar.hidden = !voltarPara;
  voltar.onclick = () => { location.hash = voltarPara; };
  const logo = $('#topo-logo');
  const urlLogo = logoValido(loja()?.logo);
  logo.hidden = Boolean(voltarPara) || !urlLogo;
  if (urlLogo && logo.getAttribute('src') !== urlLogo) logo.src = urlLogo;
  document.title = `${titulo} · ${CONFIG.APP_NOME}`;
}

function desenharNav(rota) {
  const secao = /^#\/(clientes|lancamentos)/.test(rota) ? '#/clientes'
    : /^#\/(equipe|loja|mais)/.test(rota) ? '#/mais'
    : (rota.match(/^#\/\w+/) || ['#/inicio'])[0];
  const avisos = pode('avisos_ver') ? contarAvisos() : 0;
  const itens = [
    { href: '#/inicio', rotulo: 'Início', icone: IC.casa, ok: true },
    { href: '#/clientes', rotulo: 'Clientes', icone: IC.pessoas, ok: pode('clientes_ver') },
    { href: '#/avisos', rotulo: 'Avisos', icone: IC.sino, ok: pode('avisos_ver'), badge: avisos },
    { href: '#/relatorio', rotulo: 'Painel', icone: IC.grafico, ok: pode('relatorios_ver') },
    { href: '#/mais', rotulo: 'Mais', icone: IC.menu, ok: true, badge: pode('equipe_gerenciar') ? pendentes().length : 0 }
  ];
  const nav = $('#nav');
  nav.hidden = false;
  nav.innerHTML = itens.filter(i => i.ok).map(i => `
    <a href="${i.href}" class="${secao === i.href ? 'ativo' : ''}" ${secao === i.href ? 'aria-current="page"' : ''}>
      ${i.icone}<span>${i.rotulo}</span>
      ${i.badge ? `<span class="badge" aria-label="${i.badge} avisos">${i.badge}</span>` : ''}
    </a>`).join('');
}

function esconderEstrutura() {
  $('#topo').hidden = true;
  $('#nav').hidden = true;
  conteudo.classList.add('sem-nav');
}

function exigir(permissao) {
  if (pode(permissao)) return true;
  definirTopo('Sem permissão', '#/inicio');
  conteudo.innerHTML = `
    <div class="vazio">${IC.alerta}
      <p><strong>Você não tem permissão para acessar esta tela.</strong></p>
      <p>Peça ao dono da loja para liberar o acesso.</p>
      <a class="btn btn-primario" href="#/inicio">Voltar ao início</a>
    </div>`;
  return false;
}

function naoEncontrado(voltar) {
  definirTopo('Não encontrado', voltar);
  conteudo.innerHTML = `<div class="vazio"><p>Esse registro não existe mais. Ele pode ter sido excluído por outra pessoa.</p>
    <a class="btn btn-primario" href="${voltar}">Voltar</a></div>`;
}

const logoValido = url => (typeof url === 'string' && url.startsWith('data:image/') ? url : '');
const marca = (subtitulo, logo = '') => `
  <div class="marca">
    ${logoValido(logo) ? `<img class="marca-logo" src="${esc(logo)}" alt="Logo da loja">` : '<img src="icon.svg" alt="">'}
    <h1>${esc(CONFIG.APP_NOME)}</h1>
    <p>${esc(subtitulo)}</p>
  </div>`;

/* ===================== Validações reutilizadas ===================== */
function validarLoja(d) {
  const erros = {};
  if (!d.loja_nome || d.loja_nome.length < 2) erros.loja_nome = 'Informe o nome da loja.';
  if (!telefoneValido(d.loja_telefone)) erros.loja_telefone = 'Telefone inválido. Use DDD + número.';
  const prazo = Number(d.prazo_padrao);
  if (!Number.isInteger(prazo) || prazo < 1 || prazo > 365) erros.prazo_padrao = 'Entre 1 e 365 dias.';
  const aviso = Number(d.dias_aviso);
  if (!Number.isInteger(aviso) || aviso < 0 || aviso > 30) erros.dias_aviso = 'Entre 0 e 30 dias.';
  return erros;
}
const dadosLoja = d => ({
  nome: d.loja_nome, telefone: soDigitos(d.loja_telefone), endereco: d.loja_endereco || '',
  documento: d.loja_documento || '', prazo_padrao: Number(d.prazo_padrao), dias_aviso: Number(d.dias_aviso),
  logo: logoValido(d.loja_logo)
});

/* Logo: o app reduz a imagem (máx. 160 px) para caber numa célula da planilha */
function reduzirImagem(arquivo, lado = 160) {
  return new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith('image/')) return reject(new Error('Escolha um arquivo de imagem (PNG ou JPG).'));
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * escala));
      const h = Math.max(1, Math.round(img.height * escala));
      const tela = document.createElement('canvas');
      tela.width = w; tela.height = h;
      const ctx = tela.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let dado = tela.toDataURL('image/webp', 0.85);
      if (!dado.startsWith('data:image/webp')) dado = tela.toDataURL('image/png');
      if (dado.length > 45000) { // ainda grande: JPG com fundo branco
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        dado = tela.toDataURL('image/jpeg', 0.8);
      }
      resolve(dado);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir essa imagem.')); };
    img.src = url;
  });
}
function prepararLogo(form) {
  const entrada = $('#f-logo', form);
  const oculto = form.loja_logo;
  const previa = $('#logo-previa', form);
  const remover = $('#btn-remover-logo', form);
  const mostrar = () => {
    previa.innerHTML = oculto.value ? `<img src="${esc(oculto.value)}" alt="Prévia do logo">` : IC.loja;
    remover.hidden = !oculto.value;
  };
  entrada.addEventListener('change', async () => {
    const arquivo = entrada.files[0];
    if (!arquivo) return;
    try { oculto.value = await reduzirImagem(arquivo); mostrar(); }
    catch (e) { toast(e.message, 'erro'); }
    entrada.value = '';
  });
  remover.addEventListener('click', () => { oculto.value = ''; mostrar(); });
  mostrar();
}
const camposLoja = (l = {}) => `
  <div class="campo">
    <span class="rotulo">Logo da loja</span>
    <div class="logo-envio">
      <div class="logo-previa" id="logo-previa"></div>
      <div class="acoes" style="flex:1">
        <label class="btn btn-secundario btn-pequeno" for="f-logo">Escolher imagem</label>
        <button type="button" class="btn btn-texto btn-pequeno" id="btn-remover-logo">Remover</button>
      </div>
    </div>
    <input type="file" id="f-logo" accept="image/*" hidden>
    <input type="hidden" name="loja_logo" value="${esc(logoValido(l.logo))}">
    <div class="dica">Opcional. PNG ou JPG — o app ajusta o tamanho sozinho.</div>
  </div>
  ${campo({ rotulo: 'Nome da loja', nome: 'loja_nome', valor: l.nome, obrig: true, attrs: 'autocomplete="organization" maxlength="60"' })}
  ${campo({ rotulo: 'Telefone da loja', nome: 'loja_telefone', tipo: 'tel', valor: formatarTelefone(l.telefone), obrig: true, attrs: 'inputmode="tel" placeholder="(00) 00000-0000"' })}
  ${campo({ rotulo: 'Endereço', nome: 'loja_endereco', valor: l.endereco, attrs: 'maxlength="120"' })}
  ${campo({ rotulo: 'CNPJ ou CPF', nome: 'loja_documento', valor: l.documento, attrs: 'inputmode="numeric" maxlength="20"' })}
  <div class="linha-2">
    ${campo({ rotulo: 'Prazo (dias)', nome: 'prazo_padrao', tipo: 'number', valor: l.prazo_padrao ?? 30, obrig: true, attrs: 'inputmode="numeric" min="1" max="365"', dica: 'Vencimento sugerido das compras' })}
    ${campo({ rotulo: 'Avisar antes', nome: 'dias_aviso', tipo: 'number', valor: l.dias_aviso ?? 3, obrig: true, attrs: 'inputmode="numeric" min="0" max="30"', dica: 'Dias de antecedência do aviso' })}
  </div>`;

function validarAcesso(d, { exigirPin, idAtual = null }) {
  const erros = {};
  if (!d.nome || d.nome.length < 2) erros.nome = 'Informe o nome.';
  const login = normalizar(d.login);
  if (!/^[a-z0-9._-]{3,20}$/.test(login)) erros.login = 'De 3 a 20 caracteres: letras, números, ponto, hífen ou _.';
  else if (usuarios().some(u => u.login === login && u.id !== idAtual)) erros.login = 'Esse usuário já existe.';
  if (exigirPin || d.pin) {
    if (!/^\S{4,20}$/.test(d.pin || '')) erros.pin = 'A senha deve ter de 4 a 20 caracteres, sem espaços.';
    else if (d.pin !== d.pin2) erros.pin2 = 'As senhas não são iguais.';
  }
  return erros;
}
const camposAcesso = (u = {}, { pinOpcional = false } = {}) => `
  ${campo({ rotulo: 'Nome', nome: 'nome', valor: u.nome, obrig: true, attrs: 'autocomplete="name" maxlength="60"' })}
  ${campo({ rotulo: 'Usuário (para entrar no app)', nome: 'login', valor: u.login, obrig: true, attrs: 'autocapitalize="none" autocomplete="username" maxlength="20"', dica: 'Ex.: maria ou joao.silva' })}
  <div class="linha-2">
    ${campo({ rotulo: pinOpcional ? 'Nova senha' : 'Senha', nome: 'pin', tipo: 'password', obrig: !pinOpcional, attrs: 'maxlength="20" autocomplete="new-password"', dica: pinOpcional ? 'Em branco = manter' : 'Mínimo 4 caracteres' })}
    ${campo({ rotulo: 'Confirmar senha', nome: 'pin2', tipo: 'password', obrig: !pinOpcional, attrs: 'maxlength="20" autocomplete="new-password"' })}
  </div>`;

/* ===================== TELA: Configuração inicial (cadastro da loja) ===================== */
function telaConfiguracao() {
  esconderEstrutura();
  document.title = `Configurar loja · ${CONFIG.APP_NOME}`;
  const lojaExistente = loja(); // caso a configuração tenha sido interrompida no meio
  conteudo.innerHTML = `
    <div class="tela-entrada">
      ${marca('Controle de fiado da sua loja. Vamos começar!')}
      <form id="form" class="cartao" novalidate>
        <h2 class="secao-titulo">1. Dados da loja</h2>
        ${camposLoja(lojaExistente || {})}
        <h2 class="secao-titulo">2. Seu acesso (dono)</h2>
        ${camposAcesso()}
        <button class="btn btn-primario btn-bloco" type="submit">Criar loja e entrar</button>
      </form>
      <p class="dica cor-suave" style="text-align:center">Banco de dados: ${esc(API.modo)}</p>
    </div>`;
  const form = $('#form');
  mascararTelefone(form.loja_telefone);
  prepararLogo(form);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerFormulario(form);
    if (!mostrarErros(form, { ...validarLoja(d), ...validarAcesso(d, { exigirPin: true }) })) return;
    let dono;
    const ok = await executar(async () => {
      if (lojaExistente) await API.atualizar(lojaExistente.id, dadosLoja(d));
      else await API.criar('loja', dadosLoja(d));
      const sal = novoSal();
      dono = await API.criar('usuario', {
        nome: d.nome, login: normalizar(d.login), papel: 'dono', ativo: true,
        permissoes: PERMISSOES.map(p => p.chave), pin_sal: sal, pin_hash: hashPin(d.pin, sal)
      });
    });
    if (!ok) return;
    entrar(dono);
    toast('Loja criada com sucesso!', 'ok');
  });
}

/* ===================== TELA: Entrada (abas Entrar / Cadastrar) ===================== */
function telaLogin() {
  esconderEstrutura();
  const aba = estado.abaEntrada || 'entrar';
  document.title = `${aba === 'entrar' ? 'Entrar' : 'Cadastrar'} · ${CONFIG.APP_NOME}`;
  const abas = [['entrar', 'Entrar'], ['cadastrar', 'Cadastrar']];
  conteudo.innerHTML = `
    <div class="tela-entrada">
      ${marca(loja().nome)}
      <div class="cartao">
        <div class="segmentado" role="tablist" aria-label="Entrar ou cadastrar">
          ${abas.map(([v, r]) => `<button type="button" role="tab" data-aba="${v}" class="${aba === v ? 'ativo' : ''}" aria-selected="${aba === v}">${r}</button>`).join('')}
        </div>
        ${estado.avisoEntrada ? `<div class="aviso-faixa info">${IC.check}<span>${esc(estado.avisoEntrada)}</span></div>` : ''}
        ${aba === 'entrar' ? `
        <form id="form" novalidate>
          ${campo({ rotulo: 'Usuário', nome: 'login', obrig: true, attrs: 'autocapitalize="none" autocomplete="username"' })}
          ${campo({ rotulo: 'Senha', nome: 'pin', tipo: 'password', obrig: true, attrs: 'maxlength="20" autocomplete="current-password"' })}
          <label class="check" style="border:0;margin:-8px 0 8px"><input type="checkbox" id="mostrar-senha"> Mostrar senha</label>
          <button class="btn btn-primario btn-bloco" type="submit">Entrar</button>
        </form>
        <p class="dica cor-suave" style="text-align:center;margin:16px 0 0">Esqueceu a senha? Peça ao dono da loja para criar uma nova.</p>`
        : `
        <form id="form" novalidate>
          <p class="dica cor-suave" style="margin:0 0 16px">É funcionário da loja? Crie seu acesso. O dono vai aprovar e escolher o que você pode fazer no app.</p>
          ${camposAcesso({})}
          <label class="check" style="border:0;margin:-8px 0 8px"><input type="checkbox" id="mostrar-senha"> Mostrar senha</label>
          <button class="btn btn-primario btn-bloco" type="submit">Enviar cadastro</button>
        </form>`}
      </div>
    </div>`;
  estado.avisoEntrada = '';

  $$('[data-aba]').forEach(b => b.addEventListener('click', () => { estado.abaEntrada = b.dataset.aba; telaLogin(); }));
  const form = $('#form');
  $('#mostrar-senha').addEventListener('change', e => {
    $$('input[name="pin"], input[name="pin2"]', form).forEach(i => { i.type = e.target.checked ? 'text' : 'password'; });
  });
  (aba === 'entrar' ? form.login : form.nome).focus();

  if (aba === 'entrar') {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = lerFormulario(form);
      const u = usuarios().find(x => x.login === normalizar(d.login));
      if (!u || hashPin(d.pin, u.pin_sal) !== u.pin_hash) {
        mostrarErros(form, { pin: 'Usuário ou senha incorretos.' });
        return;
      }
      if (u.pendente) { mostrarErros(form, { login: 'Seu cadastro está aguardando a aprovação do dono da loja.' }); return; }
      if (u.ativo === false) { mostrarErros(form, { login: 'Este acesso está desativado. Fale com o dono da loja.' }); return; }
      entrar(u);
    });
    return;
  }

  // Cadastro feito pelo próprio funcionário: fica pendente até o dono aprovar
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerFormulario(form);
    if (!mostrarErros(form, validarAcesso(d, { exigirPin: true }))) return;
    if (funcionarios().length >= CONFIG.MAX_FUNCIONARIOS) {
      toast(`A loja já tem ${CONFIG.MAX_FUNCIONARIOS} funcionários cadastrados. Fale com o dono.`, 'erro');
      return;
    }
    const sal = novoSal();
    const ok = await executar(() => API.criar('usuario', {
      nome: d.nome, login: normalizar(d.login), papel: 'funcionario', ativo: false, pendente: true,
      permissoes: [], pin_sal: sal, pin_hash: hashPin(d.pin, sal)
    }));
    if (!ok) return;
    estado.abaEntrada = 'entrar';
    estado.avisoEntrada = `Cadastro enviado, ${d.nome.split(' ')[0]}! Assim que o dono aprovar, entre com o usuário "${normalizar(d.login)}".`;
    telaLogin();
  });
}

function entrar(usuario) {
  estado.usuario = usuario;
  try { localStorage.setItem(CHAVE_SESSAO, usuario.id); } catch { /* modo privado */ }
  location.hash = '#/inicio';
  rotear();
  avisarVencidosAoEntrar();
}

function sair() {
  estado.usuario = null;
  try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* ignore */ }
  location.hash = '';
  rotear();
}

/* Recarrega o usuário logado (permissões podem ter mudado) */
function sincronizarUsuario() {
  let id = estado.usuario?.id;
  if (!id) { try { id = localStorage.getItem(CHAVE_SESSAO); } catch { id = null; } }
  const u = id ? API.obter(id) : null;
  estado.usuario = u && u.tabela === 'usuario' && u.ativo !== false ? u : null;
}

/* ===================== TELA: Início (Home) ===================== */
function telaInicio() {
  const l = loja();
  definirTopo(l.nome);
  const u = estado.usuario;
  const geral = resumoGeral();
  const mes = hojeISO().slice(0, 7);
  const lancsMes = API.listar('lancamento').filter(x => x.data?.slice(0, 7) === mes);
  const aReceber = somar(geral.filter(g => g.saldo > 0), g => g.saldo);
  const vencidos = geral.filter(g => g.valorVencido > 0);
  const proximos = geral.flatMap(g => g.abertas.map(c => ({ ...c, cliente: g.cliente })))
    .filter(c => c.vencimento).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 5);
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  conteudo.innerHTML = `
    <div class="saudacao">
      <h2>${saudacao}, ${esc(u.nome.split(' ')[0])}!</h2>
      <p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    </div>

    ${pode('clientes_ver') ? `
    <div class="grade-2">
      <div class="indicador"><div class="rotulo">Total a receber</div><div class="valor">${brl(aReceber)}</div>
        <div class="detalhe">${geral.filter(g => g.saldo > 0).length} cliente(s) devendo</div></div>
      <div class="indicador perigo"><div class="rotulo">Vencido</div><div class="valor">${brl(somar(vencidos, g => g.valorVencido))}</div>
        <div class="detalhe">${vencidos.length} cliente(s) em atraso</div></div>
      ${pode('relatorios_ver') ? `
      <div class="indicador sucesso"><div class="rotulo">Recebido no mês</div><div class="valor">${brl(somar(lancsMes.filter(x => x.tipo === 'pagamento'), x => x.valor))}</div></div>
      <div class="indicador alerta"><div class="rotulo">Vendido fiado no mês</div><div class="valor">${brl(somar(lancsMes.filter(x => x.tipo === 'compra'), x => x.valor))}</div></div>` : ''}
    </div>` : ''}

    <div class="acoes" style="margin-bottom:16px">
      ${pode('clientes_criar') ? `<a class="btn btn-primario" href="#/clientes/novo">${IC.mais} Novo cliente</a>` : ''}
      ${pode('clientes_ver') ? `<a class="btn btn-secundario" href="#/clientes">${IC.busca} Buscar cliente</a>` : ''}
    </div>

    ${pode('equipe_gerenciar') && pendentes().length ? `
      <a class="aviso-faixa info" href="#/equipe" style="text-decoration:none">${IC.pessoas}
        <span><strong>${pendentes().length} cadastro(s) de funcionário aguardando aprovação.</strong> Toque para liberar o acesso.</span></a>` : ''}

    ${pode('avisos_ver') && vencidos.length ? `
      <a class="aviso-faixa perigo" href="#/avisos" style="text-decoration:none">${IC.alerta}
        <span><strong>${vencidos.length} cliente(s) com pagamento vencido.</strong> Toque para ver.</span></a>` : ''}

    ${pode('clientes_ver') ? `
    <h2 class="secao-titulo">Próximos vencimentos</h2>
    ${proximos.length ? `<div class="lista">${proximos.map(c => `
      <a class="item" href="#/clientes/${c.cliente.id}">
        <div class="avatar">${esc(iniciais(c.cliente.nome))}</div>
        <div class="item-corpo">
          <div class="item-titulo">${esc(c.cliente.nome)}</div>
          <div class="item-sub ${c.vencimento < hojeISO() ? 'cor-perigo' : ''}">${dataBR(c.vencimento)} · ${textoPrazo(c.vencimento)}</div>
        </div>
        <div class="item-valor">${brl(c.restante)}</div>
      </a>`).join('')}</div>`
    : `<div class="cartao vazio">Nenhuma conta em aberto. 🎉</div>`}` : ''}`;
}

/* ===================== TELA: Clientes (Listagem / READ) ===================== */
function telaClientes() {
  if (!exigir('clientes_ver')) return;
  definirTopo('Clientes');
  const filtros = [['todos', 'Todos'], ['devendo', 'Devendo'], ['vencidos', 'Vencidos']];
  conteudo.innerHTML = `
    <div class="busca">${IC.busca}
      <input id="busca" type="search" placeholder="Buscar por nome ou telefone" aria-label="Buscar cliente" value="${esc(estado.buscaClientes)}">
    </div>
    <div class="segmentado" role="tablist">
      ${filtros.map(([v, r]) => `<button type="button" role="tab" data-filtro="${v}" class="${estado.filtroClientes === v ? 'ativo' : ''}" aria-selected="${estado.filtroClientes === v}">${r}</button>`).join('')}
    </div>
    <div id="lista-clientes"></div>
    ${pode('clientes_criar') ? `<a class="fab" href="#/clientes/novo">${IC.mais} Novo</a>` : ''}`;

  const desenhar = () => {
    const termo = normalizar(estado.buscaClientes);
    const digitos = soDigitos(estado.buscaClientes);
    let lista = resumoGeral()
      .filter(g => !termo || normalizar(g.cliente.nome).includes(termo) || (digitos && g.cliente.telefone.includes(digitos)))
      .sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR'));
    if (estado.filtroClientes === 'devendo') lista = lista.filter(g => g.saldo > 0);
    if (estado.filtroClientes === 'vencidos') lista = lista.filter(g => g.valorVencido > 0);

    $('#lista-clientes').innerHTML = lista.length ? `
      <p class="dica cor-suave" style="margin:0 0 8px">${lista.length} cliente(s)</p>
      <div class="lista">${lista.map(g => `
        <a class="item" href="#/clientes/${g.cliente.id}">
          <div class="avatar">${esc(iniciais(g.cliente.nome))}</div>
          <div class="item-corpo">
            <div class="item-titulo">${esc(g.cliente.nome)}</div>
            <div class="item-sub">${esc(formatarTelefone(g.cliente.telefone))}
              ${g.valorVencido > 0 ? ' <span class="etiqueta perigo">Vencido</span>' : g.valorAVencer > 0 ? ' <span class="etiqueta alerta">Vence logo</span>' : ''}
              ${g.cliente.limite > 0 && g.saldo >= g.cliente.limite ? ' <span class="etiqueta perigo">Limite atingido</span>' : ''}</div>
          </div>
          <div class="item-valor ${g.saldo > 0 ? 'cor-perigo' : g.saldo < 0 ? 'cor-sucesso' : 'cor-suave'}">
            ${brl(Math.abs(g.saldo))}<small>${g.saldo > 0 ? 'devendo' : g.saldo < 0 ? 'crédito' : 'em dia'}</small>
          </div>
        </a>`).join('')}</div>`
      : `<div class="vazio">${IC.caderno}<p>${API.listar('cliente').length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>
         ${!API.listar('cliente').length && pode('clientes_criar') ? '<a class="btn btn-primario" href="#/clientes/novo">Cadastrar primeiro cliente</a>' : ''}</div>`;
  };

  $('#busca').addEventListener('input', e => { estado.buscaClientes = e.target.value; desenhar(); });
  $$('[data-filtro]').forEach(b => b.addEventListener('click', () => {
    estado.filtroClientes = b.dataset.filtro;
    $$('[data-filtro]').forEach(x => { x.classList.toggle('ativo', x === b); x.setAttribute('aria-selected', x === b); });
    desenhar();
  }));
  desenhar();
}

/* ===================== TELA: Cadastro / Edição de cliente (CREATE / UPDATE) ===================== */
function telaClienteForm(id) {
  const editando = Boolean(id);
  if (!exigir(editando ? 'clientes_editar' : 'clientes_criar')) return;
  const c = editando ? API.obter(id) : {};
  if (editando && (!c || c.tabela !== 'cliente')) return naoEncontrado('#/clientes');
  definirTopo(editando ? 'Editar cliente' : 'Novo cliente', editando ? `#/clientes/${id}` : '#/clientes');

  conteudo.innerHTML = `
    <form id="form" class="cartao" novalidate>
      ${campo({ rotulo: 'Nome completo', nome: 'nome', valor: c.nome, obrig: true, attrs: 'autocomplete="off" maxlength="80"' })}
      ${campo({ rotulo: 'Telefone / WhatsApp', nome: 'telefone', tipo: 'tel', valor: formatarTelefone(c.telefone), obrig: true, attrs: 'inputmode="tel" placeholder="(00) 00000-0000"', dica: 'Obrigatório — usado para avisos de cobrança' })}
      ${campo({ rotulo: 'CPF', nome: 'cpf', valor: c.cpf, attrs: 'inputmode="numeric" maxlength="14"' })}
      ${campo({ rotulo: 'Endereço', nome: 'endereco', valor: c.endereco, attrs: 'maxlength="120"' })}
      ${campo({ rotulo: 'Limite de crédito', nome: 'limite', valor: valorParaCampo(c.limite), prefixo: 'R$', attrs: 'inputmode="decimal" placeholder="Sem limite"', dica: 'Opcional. O app bloqueia compras que passem desse valor.' })}
      <div class="campo">
        <label for="f-observacoes">Observações</label>
        <textarea id="f-observacoes" name="observacoes" maxlength="300">${esc(c.observacoes)}</textarea>
      </div>
      <button class="btn btn-primario btn-bloco" type="submit">${editando ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
    </form>`;

  const form = $('#form');
  mascararTelefone(form.telefone);
  prepararCamposValor(form);
  if (!editando) form.nome.focus();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerFormulario(form);
    const erros = {};
    if (!d.nome || d.nome.length < 3) erros.nome = 'Informe o nome (mínimo 3 letras).';
    if (!d.telefone) erros.telefone = 'O telefone é obrigatório.';
    else if (!telefoneValido(d.telefone)) erros.telefone = 'Telefone inválido. Use DDD + número.';
    else if (API.listar('cliente').some(x => x.telefone === soDigitos(d.telefone) && x.id !== id))
      erros.telefone = 'Já existe um cliente com esse telefone.';
    const limite = d.limite ? lerValor(d.limite) : 0;
    if (d.limite && (!Number.isFinite(limite) || limite < 0)) erros.limite = 'Valor inválido.';
    if (!mostrarErros(form, erros)) return;

    const dados = { nome: d.nome, telefone: soDigitos(d.telefone), cpf: d.cpf, endereco: d.endereco, limite, observacoes: d.observacoes };
    let salvo;
    const ok = await executar(async () => {
      salvo = editando ? await API.atualizar(id, dados) : await API.criar('cliente', dados);
    });
    if (!ok) return;
    toast(editando ? 'Cliente atualizado!' : 'Cliente cadastrado!', 'ok');
    location.hash = `#/clientes/${salvo.id}`;
  });
}

/* ===================== TELA: Detalhe do cliente (extrato) ===================== */
function telaClienteDetalhe(id) {
  if (!exigir('clientes_ver')) return;
  const c = API.obter(id);
  if (!c || c.tabela !== 'cliente') return naoEncontrado('#/clientes');
  definirTopo(c.nome, '#/clientes');
  const s = situacao(id);
  const restantePorCompra = Object.fromEntries(s.abertas.map(a => [a.id, a.restante]));
  const extrato = [...s.lancs].sort((a, b) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em)));
  const hoje = hojeISO();
  const nomeLoja = loja().nome;
  const msgCobranca = `Olá, ${c.nome.split(' ')[0]}! Tudo bem? Aqui é da ${nomeLoja}. ` +
    (s.valorVencido > 0 ? `Passando para lembrar que há ${brl(s.valorVencido)} vencido(s) na sua conta. ` : `Seu saldo em aberto é de ${brl(s.saldo)}. `) +
    'Qualquer dúvida, estamos à disposição. Obrigado!';

  const nomeCompra = l => l.descricao || `Compra de ${dataBR(l.data)}`;
  const comprasPorId = Object.fromEntries(s.lancs.filter(l => l.tipo === 'compra').map(l => [l.id, l]));
  const podeBaixar = pode('pagamentos_lancar');
  const limiteAtingido = c.limite > 0 && s.saldo >= c.limite;
  const etiquetaCompra = l => {
    const resta = restantePorCompra[l.id];
    if (!resta) return '<span class="etiqueta sucesso">✓ Paga</span>';
    if (l.vencimento < hoje) return `<span class="etiqueta perigo">Vencida · resta ${brl(resta)}</span>`;
    if (resta < arred(l.valor)) return `<span class="etiqueta alerta">Resta ${brl(resta)}</span>`;
    return '<span class="etiqueta neutra">Em aberto</span>';
  };

  conteudo.innerHTML = `
    <div class="cartao saldo-destaque">
      <div class="rotulo">${s.saldo >= 0 ? 'Saldo devedor' : 'Crédito do cliente'}</div>
      <div class="valor ${s.saldo > 0 ? 'cor-perigo' : 'cor-sucesso'}">${brl(Math.abs(s.saldo))}</div>
      <div class="dica cor-suave">Comprou ${brl(s.totalCompras)} · Pagou ${brl(s.totalPago)}</div>
      ${c.limite > 0 ? `<div class="dica ${limiteAtingido ? 'cor-perigo' : 'cor-suave'}">Limite: ${brl(c.limite)} · ${limiteAtingido ? '<strong>limite atingido</strong>' : `pode comprar até ${brl(arred(c.limite - s.saldo))}`}</div>` : ''}
    </div>

    ${s.valorVencido > 0 ? `<div class="aviso-faixa perigo">${IC.alerta}<span><strong>${brl(s.valorVencido)} vencido.</strong> Vencimento mais antigo em ${dataBR(s.vencidas[0].vencimento)} (${textoPrazo(s.vencidas[0].vencimento)}).</span></div>`
      : s.valorAVencer > 0 ? `<div class="aviso-faixa alerta">${IC.relogio}<span><strong>${brl(s.valorAVencer)}</strong> ${textoPrazo(s.aVencer[0].vencimento)} (${dataBR(s.aVencer[0].vencimento)}).</span></div>` : ''}

    <div class="acoes" style="margin-bottom:12px">
      ${pode('compras_lancar') ? (limiteAtingido
        ? `<button type="button" class="btn btn-perigo" disabled title="Limite de crédito atingido">${IC.compra} Limite atingido</button>`
        : `<a class="btn btn-perigo" href="#/clientes/${id}/compra">${IC.compra} Lançar compra</a>`) : ''}
      ${podeBaixar ? `<a class="btn btn-secundario" href="#/clientes/${id}/pagamento">${IC.pagamento} Receber valor</a>` : ''}
    </div>
    <div class="titulo-com-acao">
      <h2 class="secao-titulo">Compras em aberto (${s.abertas.length})</h2>
      ${podeBaixar && s.abertas.length > 1 ? '<button type="button" class="btn btn-texto btn-pequeno" id="btn-sel-todas">Selecionar todas</button>' : ''}
    </div>
    ${s.abertas.length ? `
    ${podeBaixar ? '<p class="dica cor-suave" style="margin:-4px 0 8px">Marque as compras que o cliente pagou.</p>' : ''}
    <div class="lista">${s.abertas.map(a => `
      <${podeBaixar ? 'label' : 'div'} class="item item-marcavel">
        ${podeBaixar ? `<input type="checkbox" class="marcar-pago" value="${a.id}" aria-label="Marcar ${esc(nomeCompra(a))} como pago">` : `<div class="icone-lanc compra">${IC.compra}</div>`}
        <div class="item-corpo">
          <div class="item-titulo">${esc(nomeCompra(a))}</div>
          <div class="item-sub ${a.vencimento < hoje ? 'cor-perigo' : ''}">Vence ${dataBR(a.vencimento)} · ${textoPrazo(a.vencimento)}</div>
          ${a.restante < arred(a.valor) ? `<div class="item-sub">Já pagou ${brl(arred(a.valor) - a.restante)} de ${brl(a.valor)}</div>` : ''}
        </div>
        <div class="item-valor cor-perigo">${brl(a.restante)}</div>
      </${podeBaixar ? 'label' : 'div'}>`).join('')}</div>
    ${podeBaixar ? '<p class="dica cor-suave" style="margin:-8px 0 16px">Marcou errado? Toque no pagamento no histórico para desfazer.</p>' : ''}`
    : `<div class="cartao vazio" style="padding:16px">${s.lancs.length ? '✓ Todas as compras estão pagas.' : 'Nenhuma compra lançada ainda.'}</div>`}

    <div class="cartao">
      <dl class="dados-cliente" style="margin:0">
        <div><dt>Telefone</dt><dd>${esc(formatarTelefone(c.telefone))}</dd></div>
        ${c.cpf ? `<div><dt>CPF</dt><dd>${esc(c.cpf)}</dd></div>` : ''}
        ${c.endereco ? `<div><dt>Endereço</dt><dd>${esc(c.endereco)}</dd></div>` : ''}
        ${c.observacoes ? `<div><dt>Observações</dt><dd>${esc(c.observacoes)}</dd></div>` : ''}
      </dl>
      <div class="acoes" style="margin-top:16px">
        <a class="btn btn-whats btn-pequeno" target="_blank" rel="noopener" href="${linkWhatsApp(c.telefone, msgCobranca)}">${IC.whats} WhatsApp</a>
        <a class="btn btn-secundario btn-pequeno" href="tel:${soDigitos(c.telefone)}">${IC.telefone} Ligar</a>
      </div>
    </div>

    <h2 class="secao-titulo">Histórico (${extrato.length})</h2>
    ${extrato.length ? `<div class="lista">${extrato.map(l => {
      const editavel = pode('lancamentos_editar');
      const tag = editavel ? 'a' : 'div';
      return `
      <${tag} class="item" ${editavel ? `href="#/lancamentos/${l.id}/editar"` : ''}>
        <div class="icone-lanc ${l.tipo}">${l.tipo === 'compra' ? IC.compra : IC.pagamento}</div>
        <div class="item-corpo">
          <div class="item-titulo">${l.tipo === 'pagamento' && comprasPorId[l.compra_id]
            ? `Pago: ${esc(nomeCompra(comprasPorId[l.compra_id]))}`
            : esc(l.descricao || (l.tipo === 'compra' ? 'Compra no fiado' : 'Pagamento'))}</div>
          <div class="item-sub">${dataBR(l.data)}${l.tipo === 'compra' ? ` · vence ${dataBR(l.vencimento)}` : l.forma ? ` · ${esc(l.forma)}` : ''}${l.usuario_nome ? ` · por ${esc(l.usuario_nome.split(' ')[0])}` : ''}</div>
          ${l.tipo === 'compra' ? `<div style="margin-top:4px">${etiquetaCompra(l)}</div>` : ''}
        </div>
        <div class="item-valor ${l.tipo === 'compra' ? 'cor-perigo' : 'cor-sucesso'}">${l.tipo === 'compra' ? '+' : '−'} ${brl(l.valor)}</div>
      </${tag}>`;
    }).join('')}</div>` : '<div class="cartao vazio">Nenhum lançamento ainda.</div>'}

    <div class="acoes" style="margin-top:24px">
      ${pode('clientes_editar') ? `<a class="btn btn-secundario" href="#/clientes/${id}/editar">Editar cliente</a>` : ''}
      ${pode('clientes_excluir') ? '<button class="btn btn-perigo-contorno" id="btn-excluir" type="button">Excluir cliente</button>' : ''}
    </div>

    ${podeBaixar && s.abertas.length ? `
    <div class="barra-acao" id="barra-pagar" hidden>
      <button type="button" class="btn btn-sucesso btn-bloco" id="btn-pagar-marcadas"></button>
    </div>` : ''}`;

  // Marcar como pago: marca as compras, confirma a forma e o app registra os valores sozinho
  const caixas = $$('.marcar-pago');
  const marcadas = () => caixas.filter(x => x.checked).map(x => s.abertas.find(a => a.id === x.value)).filter(Boolean);
  const atualizarBarra = () => {
    const sel = marcadas();
    const barra = $('#barra-pagar');
    if (!barra) return;
    barra.hidden = sel.length === 0;
    conteudo.classList.toggle('com-barra', sel.length > 0);
    $('#btn-pagar-marcadas').innerHTML = `${IC.check} Marcar ${sel.length} como paga${sel.length > 1 ? 's' : ''} · ${brl(somar(sel, a => a.restante))}`;
    const btnTodas = $('#btn-sel-todas');
    if (btnTodas) btnTodas.textContent = caixas.every(x => x.checked) ? 'Desmarcar todas' : 'Selecionar todas';
  };
  caixas.forEach(x => x.addEventListener('change', atualizarBarra));
  $('#btn-sel-todas')?.addEventListener('click', () => {
    const marcar = caixas.some(x => !x.checked);
    caixas.forEach(x => { x.checked = marcar; });
    atualizarBarra();
  });
  $('#btn-pagar-marcadas')?.addEventListener('click', async () => {
    const sel = marcadas();
    if (!sel.length) return;
    const total = somar(sel, a => a.restante);
    const forma = await abrirModal({
      titulo: sel.length === 1 ? `Marcar "${nomeCompra(sel[0])}" como paga?` : `Marcar ${sel.length} compras como pagas?`,
      mensagem: `Total: ${brl(total)}. Como o cliente pagou?`,
      botoes: [
        { texto: 'Pix', classe: 'btn-sucesso', valor: 'Pix' },
        { texto: 'Dinheiro', classe: 'btn-sucesso', valor: 'Dinheiro' },
        { texto: 'Cartão', classe: 'btn-sucesso', valor: 'Cartão' },
        { texto: 'Cancelar', classe: 'btn-secundario', valor: false }
      ]
    });
    if (!forma) return;
    const ok = await executar(async () => {
      for (const a of sel) {
        await API.criar('lancamento', {
          cliente_id: id, tipo: 'pagamento', valor: a.restante, data: hojeISO(), forma,
          compra_id: a.id, descricao: `Pagamento de: ${nomeCompra(a)}`,
          usuario_id: estado.usuario.id, usuario_nome: estado.usuario.nome
        });
      }
    });
    conteudo.classList.remove('com-barra');
    if (ok) toast(sel.length === 1 ? 'Compra marcada como paga! ✓' : `${sel.length} compras marcadas como pagas! ✓`, 'ok');
    rotear();
  });

  $('#btn-excluir')?.addEventListener('click', async () => {
    const extra = s.saldo > 0 ? ` Atenção: ele ainda deve ${brl(s.saldo)}.` : '';
    const sim = await confirmar({
      titulo: 'Excluir cliente?',
      mensagem: `${c.nome} e todos os ${s.lancs.length} lançamento(s) serão apagados do banco de dados. Essa ação não pode ser desfeita.${extra}`,
      ok: 'Excluir', perigo: true
    });
    if (!sim) return;
    const ok = await executar(async () => {
      for (const l of s.lancs) await API.excluir(l.id);
      await API.excluir(id);
    });
    if (!ok) return;
    toast('Cliente excluído.', 'ok');
    location.hash = '#/clientes';
  });
}

/* ===================== TELA: Lançar compra / pagamento (CREATE / UPDATE / DELETE) ===================== */
function telaLancamentoForm({ clienteId, tipo, lancId }) {
  const lanc = lancId ? API.obter(lancId) : null;
  if (lancId) {
    if (!exigir('lancamentos_editar')) return;
    if (!lanc || lanc.tabela !== 'lancamento') return naoEncontrado('#/clientes');
    clienteId = lanc.cliente_id;
    tipo = lanc.tipo;
  } else if (!exigir(tipo === 'compra' ? 'compras_lancar' : 'pagamentos_lancar')) return;

  const c = API.obter(clienteId);
  if (!c || c.tabela !== 'cliente') return naoEncontrado('#/clientes');
  const ehCompra = tipo === 'compra';
  definirTopo(`${lanc ? 'Editar' : ehCompra ? 'Lançar' : 'Registrar'} ${ehCompra ? 'compra' : 'pagamento'}`, `#/clientes/${clienteId}`);

  const s = situacao(clienteId);
  // saldo sem considerar este lançamento (para edição)
  const saldoBase = arred(s.saldo - (lanc ? (ehCompra ? lanc.valor : -lanc.valor) : 0));
  const disponivel = c.limite > 0 ? Math.max(0, arred(c.limite - saldoBase)) : Infinity;
  const hoje = hojeISO();
  const l = lanc || {};

  if (ehCompra && !lanc && disponivel <= 0) {
    conteudo.innerHTML = `
      <div class="cartao vazio">${IC.alerta}
        <p><strong>Limite de crédito atingido.</strong></p>
        <p>${esc(c.nome)} deve ${brl(s.saldo)} e o limite é ${brl(c.limite)}. Para lançar novas compras, o cliente precisa pagar ou o limite precisa ser aumentado.</p>
        <div class="acoes" style="margin-top:16px">
          ${pode('pagamentos_lancar') ? `<a class="btn btn-sucesso" href="#/clientes/${clienteId}">Receber pagamento</a>` : ''}
          ${pode('clientes_editar') ? `<a class="btn btn-secundario" href="#/clientes/${clienteId}/editar">Alterar limite</a>` : ''}
        </div>
      </div>`;
    return;
  }

  conteudo.innerHTML = `
    <div class="cartao" style="display:flex;align-items:center;gap:12px">
      <div class="avatar">${esc(iniciais(c.nome))}</div>
      <div class="item-corpo"><div class="item-titulo">${esc(c.nome)}</div>
        <div class="item-sub">Saldo atual: <strong class="${s.saldo > 0 ? 'cor-perigo' : ''}">${brl(s.saldo)}</strong></div>
        ${ehCompra && c.limite > 0 ? `<div class="item-sub">Limite ${brl(c.limite)} · <strong class="cor-sucesso">pode comprar até ${brl(disponivel)}</strong></div>` : ''}</div>
    </div>
    <form id="form" class="cartao" novalidate>
      ${ehCompra ? `
        ${campo({ rotulo: 'O que o cliente levou', nome: 'descricao', valor: l.descricao, attrs: 'maxlength="120" placeholder="Ex.: arroz, feijão e óleo"' })}
        ${campoValor('Valor da compra', 'valor', l.valor)}
        <div class="linha-2">
          ${campo({ rotulo: 'Data da compra', nome: 'data', tipo: 'date', valor: l.data || hoje, obrig: true })}
          ${campo({ rotulo: 'Vencimento', nome: 'vencimento', tipo: 'date', valor: l.vencimento || somarDias(hoje, Number(loja().prazo_padrao) || 30), obrig: true })}
        </div>`
      : `
        ${campoValor('Valor recebido', 'valor', l.valor)}
        ${saldoBase > 0 ? `<button type="button" class="btn btn-texto btn-pequeno" id="btn-total" style="margin:-8px 0 12px">Preencher valor total (${brl(saldoBase)})</button>` : ''}
        <div class="linha-2">
          ${campo({ rotulo: 'Data do pagamento', nome: 'data', tipo: 'date', valor: l.data || hoje, obrig: true })}
          <div class="campo">
            <label for="f-forma">Forma</label>
            <select id="f-forma" name="forma">${FORMAS_PAGAMENTO.map(f => `<option ${f === (l.forma || 'Dinheiro') ? 'selected' : ''}>${f}</option>`).join('')}</select>
          </div>
        </div>
        ${campo({ rotulo: 'Observação', nome: 'descricao', valor: l.descricao, attrs: 'maxlength="120"' })}`}
      <button class="btn ${ehCompra ? 'btn-perigo' : 'btn-sucesso'} btn-bloco" type="submit">${lanc ? 'Salvar alterações' : ehCompra ? 'Lançar no fiado' : 'Confirmar pagamento'}</button>
      ${lanc ? '<button class="btn btn-perigo-contorno btn-bloco" type="button" id="btn-excluir" style="margin-top:12px">Excluir lançamento</button>' : ''}
    </form>
    ${lanc?.usuario_nome ? `<p class="dica cor-suave" style="text-align:center">Lançado por ${esc(lanc.usuario_nome)} em ${new Date(lanc.criado_em).toLocaleString('pt-BR')}</p>` : ''}`;

  const form = $('#form');
  prepararCamposValor(form);
  form.valor.focus();
  $('#btn-total')?.addEventListener('click', () => { form.valor.value = valorParaCampo(saldoBase); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerFormulario(form);
    const valor = lerValor(d.valor);
    const erros = {};
    if (!Number.isFinite(valor) || valor <= 0) erros.valor = 'Informe um valor maior que zero.';
    else if (valor > 1000000) erros.valor = 'Valor muito alto. Confira.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) erros.data = 'Informe a data.';
    if (ehCompra) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.vencimento)) erros.vencimento = 'Informe o vencimento.';
      else if (d.data && d.vencimento < d.data) erros.vencimento = 'O vencimento não pode ser antes da compra.';
      // Limite de crédito: bloqueia a compra que passar do limite
      if (!erros.valor && c.limite > 0 && arred(saldoBase + valor) > c.limite) {
        erros.valor = `Passa do limite de crédito (${brl(c.limite)}). Este cliente pode comprar no máximo ${brl(disponivel)}.`;
      }
    }
    if (!mostrarErros(form, erros)) return;
    if (!ehCompra && valor > saldoBase) {
      const seguir = await confirmar({
        titulo: 'Valor maior que a dívida',
        mensagem: `O cliente deve ${brl(Math.max(saldoBase, 0))}. A diferença de ${brl(valor - Math.max(saldoBase, 0))} ficará como crédito para próximas compras.`,
        ok: 'Confirmar'
      });
      if (!seguir) return;
    }

    const dados = ehCompra
      ? { descricao: d.descricao, valor, data: d.data, vencimento: d.vencimento }
      : { descricao: d.descricao, valor, data: d.data, forma: d.forma };
    const ok = await executar(async () => {
      if (lanc) await API.atualizar(lanc.id, dados);
      else await API.criar('lancamento', {
        ...dados, cliente_id: clienteId, tipo,
        usuario_id: estado.usuario.id, usuario_nome: estado.usuario.nome
      });
    });
    if (!ok) return;
    toast(lanc ? 'Lançamento atualizado!' : ehCompra ? 'Compra lançada no fiado!' : 'Pagamento registrado!', 'ok');
    location.hash = `#/clientes/${clienteId}`;
  });

  $('#btn-excluir')?.addEventListener('click', async () => {
    const sim = await confirmar({
      titulo: 'Excluir lançamento?',
      mensagem: `${ehCompra ? 'Compra' : 'Pagamento'} de ${brl(lanc.valor)} em ${dataBR(lanc.data)} será apagado e o saldo do cliente será recalculado.`,
      ok: 'Excluir', perigo: true
    });
    if (!sim) return;
    if (!await executar(() => API.excluir(lanc.id))) return;
    toast('Lançamento excluído.', 'ok');
    location.hash = `#/clientes/${clienteId}`;
  });
}

/* ===================== TELA: Avisos de vencimento ===================== */
function telaAvisos() {
  if (!exigir('avisos_ver')) return;
  definirTopo('Avisos de vencimento');
  const geral = resumoGeral();
  const nomeLoja = loja().nome;
  const vencidos = geral.filter(g => g.valorVencido > 0).sort((a, b) => a.vencidas[0].vencimento.localeCompare(b.vencidas[0].vencimento));
  const proximos = geral.filter(g => g.valorAVencer > 0).sort((a, b) => a.aVencer[0].vencimento.localeCompare(b.aVencer[0].vencimento));

  const item = (g, vencido) => {
    const venc = vencido ? g.vencidas[0].vencimento : g.aVencer[0].vencimento;
    const valor = vencido ? g.valorVencido : g.valorAVencer;
    const msg = `Olá, ${g.cliente.nome.split(' ')[0]}! Tudo bem? Aqui é da ${nomeLoja}. ` +
      (vencido ? `Lembramos que há ${brl(valor)} com vencimento em ${dataBR(venc)} ainda em aberto.`
               : `Lembramos que ${brl(valor)} vence em ${dataBR(venc)}.`) +
      ' Qualquer dúvida, estamos à disposição. Obrigado!';
    return `
      <div class="item">
        <div class="avatar">${esc(iniciais(g.cliente.nome))}</div>
        <a class="item-corpo" href="#/clientes/${g.cliente.id}" style="color:inherit;text-decoration:none">
          <div class="item-titulo">${esc(g.cliente.nome)}</div>
          <div class="item-sub ${vencido ? 'cor-perigo' : 'cor-alerta'}">${dataBR(venc)} · ${textoPrazo(venc)}</div>
        </a>
        <div class="item-valor">${brl(valor)}</div>
        <a class="btn-icone btn-whats" style="flex-shrink:0" target="_blank" rel="noopener" aria-label="Cobrar ${esc(g.cliente.nome)} pelo WhatsApp"
           href="${linkWhatsApp(g.cliente.telefone, msg)}">${IC.whats}</a>
      </div>`;
  };

  const notifSuportada = 'Notification' in window;
  conteudo.innerHTML = `
    <div class="grade-2">
      <div class="indicador perigo"><div class="rotulo">Vencido</div><div class="valor">${brl(somar(vencidos, g => g.valorVencido))}</div><div class="detalhe">${vencidos.length} cliente(s)</div></div>
      <div class="indicador alerta"><div class="rotulo">Vence em até ${diasAviso()} dias</div><div class="valor">${brl(somar(proximos, g => g.valorAVencer))}</div><div class="detalhe">${proximos.length} cliente(s)</div></div>
    </div>

    <h2 class="secao-titulo">Vencidos</h2>
    ${vencidos.length ? `<div class="lista">${vencidos.map(g => item(g, true)).join('')}</div>` : '<div class="cartao vazio">Nenhum pagamento vencido. 👏</div>'}

    <h2 class="secao-titulo">Vencem nos próximos ${diasAviso()} dias</h2>
    ${proximos.length ? `<div class="lista">${proximos.map(g => item(g, false)).join('')}</div>` : '<div class="cartao vazio">Nada vencendo nos próximos dias.</div>'}

    ${notifSuportada && Notification.permission !== 'granted' ? `
      <button class="btn btn-secundario btn-bloco" id="btn-notif" type="button">${IC.sino} Ativar notificações no aparelho</button>
      <p class="dica cor-suave">No iPhone, as notificações funcionam com o app instalado na tela de início.</p>` : ''}`;

  $('#btn-notif')?.addEventListener('click', async () => {
    const r = await Notification.requestPermission();
    if (r === 'granted') { toast('Notificações ativadas!', 'ok'); localStorage.removeItem('caderneta_notif_dia'); avisarVencidosAoEntrar(); telaAvisos(); }
    else toast('Permissão de notificação negada.', 'erro');
  });
}

/* Ao entrar no app: mostra um toast e (se permitido) uma notificação por dia */
function avisarVencidosAoEntrar() {
  if (!pode('avisos_ver')) return;
  const n = resumoGeral().filter(g => g.valorVencido > 0).length;
  if (!n) return;
  toast(`${n} cliente(s) com pagamento vencido.`, 'erro');
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (localStorage.getItem('caderneta_notif_dia') === hojeISO()) return;
    localStorage.setItem('caderneta_notif_dia', hojeISO());
    const opcoes = { body: `${n} cliente(s) com pagamento vencido. Toque para ver.`, icon: 'icon-192.png', tag: 'vencidos' };
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then(reg => reg.showNotification(CONFIG.APP_NOME, opcoes));
    else new Notification(CONFIG.APP_NOME, opcoes);
  } catch (e) { console.warn('Notificação indisponível', e); }
}

/* ===================== TELA: Painel de recebimentos (mensal / anual) ===================== */
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brlCurto = v => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v)}`);
function topoDaEscala(max) {
  if (max <= 0) return 100;
  const pot = 10 ** Math.floor(Math.log10(max));
  for (const passo of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (passo * pot >= max) return passo * pot;
  return 10 * pot;
}

/* Gráfico de barras em HTML/CSS.
   series: [{ nome, classe }]  ·  colunas: [{ eixo, titulo, valores: [] }] */
function graficoBarras({ series, colunas, altura = 180, rotuloAria }) {
  const topo = topoDaEscala(Math.max(0, ...colunas.flatMap(c => c.valores)));
  const pct = v => (v > 0 ? Math.max(1.5, (v / topo) * 100) : 0);
  return `
    <div class="grafico" role="group" aria-label="${esc(rotuloAria)}">
      ${series.length > 1 ? `<div class="grafico-legenda">${series.map(s => `<span class="leg"><i class="amostra ${s.classe}"></i>${esc(s.nome)}</span>`).join('')}</div>` : ''}
      <div class="grafico-area" style="height:${altura}px">
        ${[1, 0.5, 0].map(f => `<div class="linha-grade" style="top:${(1 - f) * 100}%"><span>${brlCurto(topo * f)}</span></div>`).join('')}
        <div class="grafico-colunas">
          ${colunas.map((c, i) => `
            <button type="button" class="grafico-col" data-i="${i}"
              aria-label="${esc(c.titulo)}: ${series.map((s, j) => `${s.nome} ${brl(c.valores[j])}`).join(', ')}">
              ${c.valores.map((v, j) => `<span class="barra ${series[j].classe}" style="height:${pct(v)}%"></span>`).join('')}
            </button>`).join('')}
        </div>
      </div>
      <div class="grafico-eixo-x" aria-hidden="true">${colunas.map(c => `<span>${esc(c.eixo)}</span>`).join('')}</div>
      <div class="grafico-dica" hidden></div>
    </div>`;
}

/* Dica (tooltip) ao passar o mouse ou tocar numa coluna */
function ativarGraficos(series, colunasPorGrafico) {
  $$('.grafico').forEach((graf, k) => {
    const colunas = colunasPorGrafico[k];
    const dica = $('.grafico-dica', graf);
    const mostrar = btn => {
      const c = colunas[btn.dataset.i];
      const ss = series[k];
      $$('.grafico-col', graf).forEach(b => b.classList.toggle('ativo', b === btn));
      dica.innerHTML = `<strong>${esc(c.titulo)}</strong>` +
        ss.map((s, j) => `<span class="lin"><i class="amostra ${s.classe}"></i>${esc(s.nome)}: <b>${brl(c.valores[j])}</b></span>`).join('');
      dica.hidden = false;
      const caixa = graf.getBoundingClientRect(), r = btn.getBoundingClientRect();
      const meia = dica.offsetWidth / 2;
      const x = Math.min(Math.max(r.left - caixa.left + r.width / 2, meia), caixa.width - meia);
      dica.style.left = `${x}px`;
      dica.style.top = `${$('.grafico-area', graf).offsetTop}px`; // abaixo da legenda
    };
    const esconder = () => { dica.hidden = true; $$('.grafico-col', graf).forEach(b => b.classList.remove('ativo')); };
    $$('.grafico-col', graf).forEach(btn => {
      btn.addEventListener('pointerenter', () => mostrar(btn));
      btn.addEventListener('focus', () => mostrar(btn));
      btn.addEventListener('click', () => mostrar(btn));
      btn.addEventListener('blur', esconder);
    });
    graf.addEventListener('pointerleave', esconder);
  });
}

const SERIES_VENDIDO_RECEBIDO = [{ nome: 'Vendido no fiado', classe: 'serie-vendido' }, { nome: 'Recebido', classe: 'serie-recebido' }];
const SERIE_RECEBIDO = [{ nome: 'Recebido', classe: 'serie-recebido' }];

function telaRelatorio() {
  if (!exigir('relatorios_ver')) return;
  definirTopo('Painel de recebimentos');
  const visao = estado.visaoRelatorio || 'mes';
  const corpo = visao === 'ano' ? relatorioAnual() : relatorioMensal();
  conteudo.innerHTML = `
    <div class="segmentado segmentado-destaque nao-imprimir" role="tablist" aria-label="Período">
      <button type="button" role="tab" data-visao="mes" class="${visao === 'mes' ? 'ativo' : ''}" aria-selected="${visao === 'mes'}">Mensal</button>
      <button type="button" role="tab" data-visao="ano" class="${visao === 'ano' ? 'ativo' : ''}" aria-selected="${visao === 'ano'}">Anual</button>
    </div>
    ${corpo.html}
    <button class="btn btn-secundario btn-bloco nao-imprimir" id="btn-imprimir" type="button">${IC.imprimir} Imprimir / salvar em PDF</button>`;
  $$('[data-visao]').forEach(b => b.addEventListener('click', () => { estado.visaoRelatorio = b.dataset.visao; telaRelatorio(); }));
  $('#btn-imprimir').onclick = () => window.print();
  corpo.ligar();
}

function cabecalhoImpressao(periodo) {
  return `
    <div class="cabecalho-impressao">
      ${logoValido(loja().logo) ? `<img src="${esc(loja().logo)}" alt="">` : ''}
      <div><strong>${esc(loja().nome)}</strong><br>Painel de recebimentos · ${esc(periodo)}</div>
    </div>`;
}

/* ---------- Visão mensal ---------- */
function relatorioMensal() {
  const mes = estado.mesRelatorio || hojeISO().slice(0, 7);
  const [anoN, mesN] = mes.split('-').map(Number);
  const doMes = data => data?.slice(0, 7) === mes;
  const nomes = Object.fromEntries(API.listar('cliente').map(c => [c.id, c.nome]));

  const lancs = API.listar('lancamento');
  const pagamentos = lancs.filter(l => l.tipo === 'pagamento' && doMes(l.data)).sort((a, b) => a.data.localeCompare(b.data));
  const compras = lancs.filter(l => l.tipo === 'compra' && doMes(l.data));
  const recebido = somar(pagamentos, l => l.valor);
  const vendido = somar(compras, l => l.valor);

  const geral = resumoGeral();
  const abertas = geral.flatMap(g => g.abertas);
  const faltaTotal = somar(geral.filter(g => g.saldo > 0), g => g.saldo);
  const vencidoTotal = somar(geral, g => g.valorVencido);
  const abertoComprasMes = somar(abertas.filter(c => doMes(c.data)), c => c.restante);
  const previstoMes = somar(abertas.filter(c => doMes(c.vencimento)), c => c.restante);

  const porForma = {};
  for (const p of pagamentos) porForma[p.forma || 'Outro'] = arred((porForma[p.forma || 'Outro'] || 0) + Number(p.valor));
  const devedores = geral.filter(g => g.saldo > 0).sort((a, b) => b.saldo - a.saldo);

  // Recebimentos por dia (gráfico)
  const diasNoMes = new Date(anoN, mesN, 0).getDate();
  const porDia = Array(diasNoMes).fill(0);
  for (const p of pagamentos) porDia[Number(p.data.slice(8, 10)) - 1] += Number(p.valor);
  const marcos = new Set([1, 5, 10, 15, 20, 25, diasNoMes]);
  const colunasDia = porDia.map((v, i) => ({
    eixo: marcos.has(i + 1) ? String(i + 1) : '',
    titulo: `${String(i + 1).padStart(2, '0')}/${String(mesN).padStart(2, '0')}/${anoN}`,
    valores: [arred(v)]
  }));

  const html = `
    ${cabecalhoImpressao(nomeMes(mes))}
    <div class="seletor-mes">
      <button class="btn-icone nao-imprimir" id="per-ant" aria-label="Mês anterior">${IC.esq}</button>
      <strong>${nomeMes(mes)}</strong>
      <button class="btn-icone nao-imprimir" id="per-prox" aria-label="Próximo mês">${IC.dirG}</button>
    </div>

    <div class="grade-2">
      <div class="indicador sucesso"><div class="rotulo">Recebido no mês</div><div class="valor">${brl(recebido)}</div><div class="detalhe">${pagamentos.length} pagamento(s)</div></div>
      <div class="indicador alerta"><div class="rotulo">Vendido fiado no mês</div><div class="valor">${brl(vendido)}</div><div class="detalhe">${compras.length} compra(s)</div></div>
      <div class="indicador"><div class="rotulo">Falta receber (total)</div><div class="valor">${brl(faltaTotal)}</div><div class="detalhe">Saldo de todos os clientes hoje</div></div>
      <div class="indicador perigo"><div class="rotulo">Vencido hoje</div><div class="valor">${brl(vencidoTotal)}</div><div class="detalhe">Já passou do vencimento</div></div>
    </div>

    <div class="cartao">
      <h2 class="titulo-grafico">Recebimentos por dia</h2>
      ${recebido > 0 ? graficoBarras({ series: SERIE_RECEBIDO, colunas: colunasDia, altura: 150, rotuloAria: `Recebimentos por dia em ${nomeMes(mes)}` })
        : '<p class="vazio" style="padding:16px">Nenhum recebimento neste mês.</p>'}
      <dl class="dados-cliente" style="margin:16px 0 0">
        <div><dt>Vendido no fiado no mês</dt><dd>${brl(vendido)}</dd></div>
        <div><dt>Recebido no mês</dt><dd class="cor-sucesso">${brl(recebido)}</dd></div>
        <div><dt>Das compras deste mês, ainda em aberto</dt><dd>${brl(abertoComprasMes)}</dd></div>
        <div><dt>A receber com vencimento neste mês</dt><dd>${brl(previstoMes)}</dd></div>
      </dl>
    </div>

    <h2 class="secao-titulo">Recebimentos do mês</h2>
    ${pagamentos.length ? `
    <div class="cartao" style="overflow-x:auto">
      <table class="tabela">
        <thead><tr><th>Data</th><th>Cliente</th><th>Forma</th><th class="num">Valor</th></tr></thead>
        <tbody>${pagamentos.map(p => `<tr><td>${dataBR(p.data).slice(0, 5)}</td><td>${esc(nomes[p.cliente_id] || '(excluído)')}</td><td>${esc(p.forma || '—')}</td><td class="num">${brl(p.valor)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="num">${brl(recebido)}</td></tr></tfoot>
      </table>
      <p class="dica cor-suave" style="margin:12px 0 0">${Object.entries(porForma).map(([f, v]) => `${esc(f)}: ${brl(v)}`).join(' · ')}</p>
    </div>` : '<div class="cartao vazio">Nenhum pagamento recebido neste mês.</div>'}

    <h2 class="secao-titulo">Quem ainda deve (hoje)</h2>
    ${devedores.length ? `
    <div class="cartao" style="overflow-x:auto">
      <table class="tabela">
        <thead><tr><th>Cliente</th><th class="num">Vencido</th><th class="num">Saldo</th></tr></thead>
        <tbody>${devedores.map(g => `<tr><td>${esc(g.cliente.nome)}</td><td class="num ${g.valorVencido > 0 ? 'cor-perigo' : 'cor-suave'}">${brl(g.valorVencido)}</td><td class="num">${brl(g.saldo)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="num cor-perigo">${brl(vencidoTotal)}</td><td class="num">${brl(faltaTotal)}</td></tr></tfoot>
      </table>
    </div>` : '<div class="cartao vazio">Ninguém devendo. 🎉</div>'}`;

  return {
    html,
    ligar: () => {
      $('#per-ant').onclick = () => { estado.mesRelatorio = mudarMes(mes, -1); telaRelatorio(); };
      $('#per-prox').onclick = () => { estado.mesRelatorio = mudarMes(mes, 1); telaRelatorio(); };
      if (recebido > 0) ativarGraficos([SERIE_RECEBIDO], [colunasDia]);
    }
  };
}

/* ---------- Visão anual ---------- */
function relatorioAnual() {
  const hoje = hojeISO();
  const ano = estado.anoRelatorio || Number(hoje.slice(0, 4));
  const lancs = API.listar('lancamento').filter(l => l.data?.slice(0, 4) === String(ano));
  const meses = MESES.map((nome, i) => {
    const chave = `${ano}-${String(i + 1).padStart(2, '0')}`;
    const doMes = lancs.filter(l => l.data.slice(0, 7) === chave);
    return {
      nome, chave,
      vendido: somar(doMes.filter(l => l.tipo === 'compra'), l => l.valor),
      recebido: somar(doMes.filter(l => l.tipo === 'pagamento'), l => l.valor),
      pagamentos: doMes.filter(l => l.tipo === 'pagamento').length
    };
  });
  const recebidoAno = somar(meses, m => m.recebido);
  const vendidoAno = somar(meses, m => m.vendido);
  const anoAtual = Number(hoje.slice(0, 4));
  const mesesDecorridos = ano < anoAtual ? 12 : ano === anoAtual ? Number(hoje.slice(5, 7)) : 12;
  const media = arred(recebidoAno / Math.max(1, mesesDecorridos));
  const melhor = meses.reduce((a, b) => (b.recebido > a.recebido ? b : a), meses[0]);

  const porForma = {};
  for (const p of lancs.filter(l => l.tipo === 'pagamento')) porForma[p.forma || 'Outro'] = arred((porForma[p.forma || 'Outro'] || 0) + Number(p.valor));
  const formas = Object.entries(porForma).sort((a, b) => b[1] - a[1]);

  const colunas = meses.map(m => ({ eixo: m.nome.slice(0, 3), titulo: `${m.nome} de ${ano}`, valores: [m.vendido, m.recebido] }));

  const html = `
    ${cabecalhoImpressao(`Ano de ${ano}`)}
    <div class="seletor-mes">
      <button class="btn-icone nao-imprimir" id="per-ant" aria-label="Ano anterior">${IC.esq}</button>
      <strong>${ano}</strong>
      <button class="btn-icone nao-imprimir" id="per-prox" aria-label="Próximo ano">${IC.dirG}</button>
    </div>

    <div class="grade-2">
      <div class="indicador sucesso"><div class="rotulo">Recebido no ano</div><div class="valor">${brl(recebidoAno)}</div><div class="detalhe">${somar(meses, m => m.pagamentos)} pagamento(s)</div></div>
      <div class="indicador alerta"><div class="rotulo">Vendido fiado no ano</div><div class="valor">${brl(vendidoAno)}</div><div class="detalhe">${vendidoAno > 0 ? `${Math.round((recebidoAno / vendidoAno) * 100)}% já recebido` : '—'}</div></div>
      <div class="indicador"><div class="rotulo">Média recebida por mês</div><div class="valor">${brl(media)}</div><div class="detalhe">${mesesDecorridos} ${mesesDecorridos === 1 ? 'mês' : 'meses'}</div></div>
      <div class="indicador"><div class="rotulo">Melhor mês</div><div class="valor">${melhor.recebido > 0 ? melhor.nome : '—'}</div><div class="detalhe">${melhor.recebido > 0 ? brl(melhor.recebido) : 'Sem recebimentos'}</div></div>
    </div>

    <div class="cartao">
      <h2 class="titulo-grafico">Vendido x recebido por mês</h2>
      ${recebidoAno + vendidoAno > 0
        ? graficoBarras({ series: SERIES_VENDIDO_RECEBIDO, colunas, altura: 190, rotuloAria: `Vendido e recebido por mês em ${ano}` })
        : '<p class="vazio" style="padding:16px">Nenhum lançamento neste ano.</p>'}
    </div>

    <h2 class="secao-titulo">Mês a mês</h2>
    <div class="cartao" style="overflow-x:auto">
      <table class="tabela tabela-meses">
        <thead><tr><th>Mês</th><th class="num">Vendido</th><th class="num">Recebido</th></tr></thead>
        <tbody>${meses.map(m => `
          <tr>
            <td><button type="button" class="link-mes" data-mes="${m.chave}">${m.nome}</button></td>
            <td class="num ${m.vendido ? '' : 'cor-suave'}">${brl(m.vendido)}</td>
            <td class="num ${m.recebido ? 'cor-sucesso' : 'cor-suave'}">${brl(m.recebido)}</td>
          </tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${brl(vendidoAno)}</td><td class="num">${brl(recebidoAno)}</td></tr></tfoot>
      </table>
      <p class="dica cor-suave nao-imprimir" style="margin:12px 0 0">Toque no nome do mês para ver os detalhes.</p>
    </div>

    <h2 class="secao-titulo">Formas de pagamento no ano</h2>
    ${formas.length ? `<div class="cartao">${formas.map(([f, v]) => `
      <div class="barra-comp">
        <div class="linha"><span>${esc(f)}</span><strong>${brl(v)} <span class="cor-suave" style="font-weight:500">· ${Math.round((v / recebidoAno) * 100)}%</span></strong></div>
        <div class="trilho"><div class="preench serie-recebido" style="width:${(v / formas[0][1]) * 100}%"></div></div>
      </div>`).join('')}</div>` : '<div class="cartao vazio">Nenhum pagamento neste ano.</div>'}`;

  return {
    html,
    ligar: () => {
      $('#per-ant').onclick = () => { estado.anoRelatorio = ano - 1; telaRelatorio(); };
      $('#per-prox').onclick = () => { estado.anoRelatorio = ano + 1; telaRelatorio(); };
      $$('.link-mes').forEach(b => b.addEventListener('click', () => {
        estado.mesRelatorio = b.dataset.mes; estado.visaoRelatorio = 'mes'; telaRelatorio(); window.scrollTo(0, 0);
      }));
      if (recebidoAno + vendidoAno > 0) ativarGraficos([SERIES_VENDIDO_RECEBIDO], [colunas]);
    }
  };
}

/* ===================== TELA: Mais (menu) ===================== */
function telaMais() {
  definirTopo('Mais opções');
  const u = estado.usuario;
  const link = (href, icone, titulo, sub, id = '') => `
    <${href ? `a href="${href}"` : `button type="button" id="${id}"`} class="item">
      <div class="icone-lanc" style="background:var(--primaria-clara);color:var(--primaria)">${icone}</div>
      <div class="item-corpo"><div class="item-titulo">${titulo}</div>${sub ? `<div class="item-sub">${sub}</div>` : ''}</div>
      ${IC.dir}
    </${href ? 'a' : 'button'}>`;

  conteudo.innerHTML = `
    <div class="cartao" style="display:flex;align-items:center;gap:12px">
      <div class="avatar">${esc(iniciais(u.nome))}</div>
      <div class="item-corpo"><div class="item-titulo">${esc(u.nome)}</div>
        <div class="item-sub">@${esc(u.login)} · ${u.papel === 'dono' ? 'Dono' : 'Funcionário'}</div></div>
    </div>
    <div class="lista">
      ${pode('equipe_gerenciar') ? link('#/equipe', IC.pessoas, 'Funcionários e permissões', pendentes().length ? `<strong class="cor-alerta">${pendentes().length} aguardando aprovação</strong>` : `${funcionarios().length} de ${CONFIG.MAX_FUNCIONARIOS} cadastrados`) : ''}
      ${pode('loja_editar') ? link('#/loja', logoValido(loja().logo) ? `<img class="icone-logo" src="${esc(loja().logo)}" alt="">` : IC.loja, 'Dados da loja e logo', esc(loja().nome)) : ''}
      ${link('', IC.atualizar, 'Atualizar dados', 'Buscar as últimas alterações da equipe', 'btn-sync')}
      ${link('', IC.instalar, 'Instalar no celular', 'Android e iPhone', 'btn-instalar')}
      ${link('', IC.sair, 'Sair', '', 'btn-sair')}
    </div>
    <p class="dica cor-suave" style="text-align:center">Banco de dados: ${esc(API.modo)}</p>`;

  $('#btn-sync').onclick = () => atualizarDados(true);
  $('#btn-sair').onclick = async () => { if (await confirmar({ titulo: 'Sair do app?', mensagem: 'Você precisará do usuário e da senha para entrar de novo.', ok: 'Sair' })) sair(); };
  $('#btn-instalar').onclick = async () => {
    if (promptInstalacao) { promptInstalacao.prompt(); promptInstalacao = null; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    informar('Instalar o app', ios
      ? 'No Safari, toque no botão Compartilhar (quadrado com seta) e depois em "Adicionar à Tela de Início".'
      : 'No Chrome, abra o menu (⋮) e toque em "Instalar app" ou "Adicionar à tela inicial".');
  };
}

/* ===================== TELA: Equipe (listagem de funcionários) ===================== */
function telaEquipe() {
  if (!exigir('equipe_gerenciar')) return;
  definirTopo('Funcionários', '#/mais');
  const dono = usuarios().find(u => u.papel === 'dono');
  const funcs = funcionarios().sort((a, b) => (b.pendente ? 1 : 0) - (a.pendente ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const cheio = funcs.length >= CONFIG.MAX_FUNCIONARIOS;
  const souDono = estado.usuario.papel === 'dono';

  const item = u => {
    const editavel = u.papel !== 'dono' || souDono;
    const tag = editavel ? 'a' : 'div';
    return `
    <${tag} class="item" ${editavel ? `href="#/equipe/${u.id}/editar"` : ''}>
      <div class="avatar">${esc(iniciais(u.nome))}</div>
      <div class="item-corpo">
        <div class="item-titulo">${esc(u.nome)}</div>
        <div class="item-sub">@${esc(u.login)} · ${u.papel === 'dono' ? 'todas as permissões' : u.pendente ? 'aguardando aprovação' : `${(u.permissoes || []).length} permissão(ões)`}</div>
      </div>
      ${u.papel === 'dono' ? '<span class="etiqueta sucesso">Dono</span>' : u.pendente ? '<span class="etiqueta alerta">Aprovar</span>' : u.ativo === false ? '<span class="etiqueta neutra">Inativo</span>' : '<span class="etiqueta sucesso">Ativo</span>'}
    </${tag}>`;
  };

  conteudo.innerHTML = `
    ${pendentes().length ? `<div class="aviso-faixa alerta">${IC.relogio}<span><strong>${pendentes().length} cadastro(s) aguardando aprovação.</strong> Toque no nome para escolher as permissões e liberar.</span></div>` : ''}
    <div class="aviso-faixa info">${IC.pessoas}<span><strong>${funcs.length} de ${CONFIG.MAX_FUNCIONARIOS}</strong> funcionários cadastrados. Cada um entra com seu próprio usuário e senha e só vê o que você liberar.</span></div>
    <div class="lista">${dono ? item(dono) : ''}${funcs.map(item).join('')}</div>
    ${!funcs.length ? '<p class="vazio">Nenhum funcionário ainda.</p>' : ''}
    ${cheio ? `<div class="aviso-faixa alerta">${IC.alerta}<span>Limite de ${CONFIG.MAX_FUNCIONARIOS} funcionários atingido. Exclua ou edite um existente.</span></div>`
            : `<a class="fab" href="#/equipe/novo">${IC.mais} Funcionário</a>`}`;
}

/* ===================== TELA: Cadastro / edição de funcionário + permissões ===================== */
function telaFuncionarioForm(id) {
  if (!exigir('equipe_gerenciar')) return;
  const editando = Boolean(id);
  const u = editando ? API.obter(id) : null;
  if (editando && (!u || u.tabela !== 'usuario')) return naoEncontrado('#/equipe');
  const ehDono = u?.papel === 'dono';
  const souEu = u?.id === estado.usuario.id;
  if (ehDono && estado.usuario.papel !== 'dono') return exigir('__somente_dono__');
  if (!editando && funcionarios().length >= CONFIG.MAX_FUNCIONARIOS) {
    toast(`Limite de ${CONFIG.MAX_FUNCIONARIOS} funcionários atingido.`, 'erro');
    location.hash = '#/equipe';
    return;
  }
  // Funcionário não pode alterar as próprias permissões (evita autoliberação)
  const podeMudarPermissoes = !ehDono && !(souEu && estado.usuario.papel !== 'dono');
  const aprovando = Boolean(u?.pendente);
  definirTopo(aprovando ? 'Aprovar cadastro' : editando ? (ehDono ? 'Meu acesso (dono)' : 'Editar funcionário') : 'Novo funcionário', '#/equipe');
  const perms = new Set(u && !aprovando ? u.permissoes || [] : PERMISSOES_PADRAO);

  conteudo.innerHTML = `
    <form id="form" novalidate>
      ${aprovando ? `<div class="aviso-faixa alerta">${IC.relogio}<span><strong>${esc(u.nome)} pediu acesso pela tela de entrada.</strong> Confira os dados, escolha as permissões e toque em Aprovar acesso.</span></div>` : ''}
      <div class="cartao">
        ${camposAcesso(u || {}, { pinOpcional: editando })}
        ${!ehDono && !aprovando ? `<label class="check"><input type="checkbox" name="ativo" ${u?.ativo === false ? '' : 'checked'} ${souEu ? 'disabled' : ''}> Acesso ativo</label>` : ''}
      </div>
      ${!ehDono ? `
      <div class="cartao">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2 class="secao-titulo" style="margin:0">Permissões</h2>
          ${podeMudarPermissoes ? '<button type="button" class="btn btn-texto btn-pequeno" id="btn-todas">Marcar todas</button>' : ''}
        </div>
        ${!podeMudarPermissoes ? '<p class="dica cor-suave">Somente o dono pode alterar as suas permissões.</p>' : ''}
        ${PERMISSOES.map(p => `
          <label class="check"><input type="checkbox" name="perm" value="${p.chave}" ${perms.has(p.chave) ? 'checked' : ''} ${podeMudarPermissoes ? '' : 'disabled'}> ${p.nome}</label>`).join('')}
      </div>` : '<div class="aviso-faixa info">O dono tem acesso a tudo e não pode ser excluído.</div>'}
      <button class="btn ${aprovando ? 'btn-sucesso' : 'btn-primario'} btn-bloco" type="submit">${aprovando ? `${IC.check} Aprovar acesso` : editando ? 'Salvar alterações' : 'Cadastrar funcionário'}</button>
      ${editando && !ehDono && !souEu ? `<button class="btn btn-perigo-contorno btn-bloco" type="button" id="btn-excluir" style="margin-top:12px">${aprovando ? 'Recusar cadastro' : 'Excluir funcionário'}</button>` : ''}
    </form>`;

  const form = $('#form');
  $('#btn-todas')?.addEventListener('click', () => {
    const caixas = $$('input[name="perm"]', form);
    const marcar = caixas.some(c => !c.checked);
    caixas.forEach(c => { c.checked = marcar; });
    $('#btn-todas').textContent = marcar ? 'Desmarcar todas' : 'Marcar todas';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerFormulario(form);
    if (!mostrarErros(form, validarAcesso(d, { exigirPin: !editando, idAtual: id }))) return;
    const permissoes = $$('input[name="perm"]:checked', form).map(c => c.value);
    if (!ehDono && podeMudarPermissoes && !permissoes.length) { toast('Marque pelo menos uma permissão.', 'erro'); return; }

    const dados = { nome: d.nome, login: normalizar(d.login) };
    if (!ehDono) {
      if (podeMudarPermissoes) dados.permissoes = permissoes;
      if (aprovando) { dados.ativo = true; dados.pendente = false; }
      else if (!souEu) dados.ativo = form.ativo.checked;
    }
    if (d.pin) { dados.pin_sal = novoSal(); dados.pin_hash = hashPin(d.pin, dados.pin_sal); }

    const ok = await executar(async () => {
      if (editando) {
        const salvo = await API.atualizar(id, dados);
        if (souEu) estado.usuario = salvo;
      } else {
        await API.criar('usuario', { ...dados, papel: 'funcionario', ativo: form.ativo.checked, permissoes });
      }
    });
    if (!ok) return;
    toast(aprovando ? `Acesso de ${d.nome.split(' ')[0]} liberado!` : editando ? 'Dados salvos!' : 'Funcionário cadastrado!', 'ok');
    location.hash = '#/equipe';
  });

  $('#btn-excluir')?.addEventListener('click', async () => {
    const sim = await confirmar({
      titulo: aprovando ? 'Recusar cadastro?' : 'Excluir funcionário?',
      mensagem: aprovando ? `O pedido de acesso de ${u.nome} será apagado.` : `${u.nome} não poderá mais entrar no app. Os lançamentos feitos por ele continuam no histórico.`,
      ok: aprovando ? 'Recusar' : 'Excluir', perigo: true
    });
    if (!sim) return;
    if (!await executar(() => API.excluir(id))) return;
    toast('Funcionário excluído.', 'ok');
    location.hash = '#/equipe';
  });
}

/* ===================== TELA: Dados da loja ===================== */
function telaLoja() {
  if (!exigir('loja_editar')) return;
  definirTopo('Dados da loja', '#/mais');
  const l = loja();
  conteudo.innerHTML = `
    <form id="form" class="cartao" novalidate>
      ${camposLoja(l)}
      <button class="btn btn-primario btn-bloco" type="submit">Salvar</button>
    </form>`;
  const form = $('#form');
  mascararTelefone(form.loja_telefone);
  prepararLogo(form);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerFormulario(form);
    if (!mostrarErros(form, validarLoja(d))) return;
    if (!await executar(() => API.atualizar(l.id, dadosLoja(d)))) return;
    toast('Dados da loja salvos!', 'ok');
    location.hash = '#/mais';
  });
}

/* ===================== Erro de conexão ===================== */
function telaErroConexao() {
  esconderEstrutura();
  conteudo.innerHTML = `
    <div class="tela-entrada">
      ${marca('Não foi possível carregar os dados')}
      <div class="cartao">
        <p>Verifique sua internet e se o link em <code>config.js</code> está correto (Apps Script implantado para "Qualquer pessoa", ou cenários do Make <strong>ativos</strong>).</p>
        <button class="btn btn-primario btn-bloco" id="btn-tentar">Tentar novamente</button>
      </div>
    </div>`;
  $('#btn-tentar').onclick = iniciar;
}

/* ===================== Rotas ===================== */
const ROTAS = [
  [/^#\/inicio$/, telaInicio],
  [/^#\/clientes$/, telaClientes],
  [/^#\/clientes\/novo$/, () => telaClienteForm()],
  [/^#\/clientes\/([\w-]+)$/, id => telaClienteDetalhe(id)],
  [/^#\/clientes\/([\w-]+)\/editar$/, id => telaClienteForm(id)],
  [/^#\/clientes\/([\w-]+)\/(compra|pagamento)$/, (id, tipo) => telaLancamentoForm({ clienteId: id, tipo })],
  [/^#\/lancamentos\/([\w-]+)\/editar$/, id => telaLancamentoForm({ lancId: id })],
  [/^#\/avisos$/, telaAvisos],
  [/^#\/relatorio$/, telaRelatorio],
  [/^#\/mais$/, telaMais],
  [/^#\/equipe$/, telaEquipe],
  [/^#\/equipe\/novo$/, () => telaFuncionarioForm()],
  [/^#\/equipe\/([\w-]+)\/editar$/, id => telaFuncionarioForm(id)],
  [/^#\/loja$/, telaLoja]
];
const ROTAS_FORMULARIO = /\/(novo|editar|compra|pagamento)$|^#\/loja$/;

function rotear() {
  // Sem loja ou sem dono cadastrado = primeira configuração
  if (!loja() || !usuarios().some(u => u.papel === 'dono')) return telaConfiguracao();
  if (!estado.usuario) return telaLogin();
  const hash = location.hash || '#/inicio';
  for (const [regex, tela] of ROTAS) {
    const m = hash.match(regex);
    if (!m) continue;
    conteudo.classList.remove('sem-nav', 'com-barra');
    desenharNav(hash);
    tela(...m.slice(1));
    window.scrollTo(0, 0);
    return;
  }
  location.replace('#/inicio');
}

async function atualizarDados(avisar) {
  if (!await executar(() => API.carregar())) return;
  sincronizarUsuario();
  rotear();
  if (avisar) toast('Dados atualizados!', 'ok');
}

/* ===================== Inicialização ===================== */
async function iniciar() {
  const ok = await executar(() => API.carregar());
  if (!ok) return telaErroConexao();
  sincronizarUsuario();
  rotear();
  if (estado.usuario) avisarVencidosAoEntrar();
}

window.addEventListener('hashchange', rotear);
$('#btn-atualizar').addEventListener('click', () => atualizarDados(true));

/* ===================== Atualização automática ===================== */
/* Só redesenha a tela quando os dados mudaram e o usuário não está
   no meio de algo (digitando, com janela aberta ou marcando compras). */
function podeAtualizarSozinho() {
  const foco = document.activeElement;
  return Boolean(estado.usuario) &&
    document.visibilityState === 'visible' &&
    $('#modal').hidden && carregamentos === 0 &&
    !ROTAS_FORMULARIO.test(location.hash) &&
    !conteudo.classList.contains('com-barra') &&
    !(foco && foco.matches('input, textarea, select'));
}

let sincronizando = false;
async function sincronizarSilencioso() {
  if (sincronizando || !podeAtualizarSozinho()) return;
  sincronizando = true;
  try {
    const antes = API.assinatura();
    await API.carregar();
    if (API.assinatura() === antes || !podeAtualizarSozinho()) return;
    const rolagem = window.scrollY;
    sincronizarUsuario();
    rotear();
    window.scrollTo(0, rolagem); // mantém a posição da tela
  } catch (e) {
    console.warn('Atualização automática falhou (vai tentar de novo)', e);
  } finally {
    sincronizando = false;
  }
}

// Modo local: outra aba/janela salvou algo -> atualiza na hora
window.addEventListener('storage', e => { if (e.key === API.CHAVE_LOCAL) sincronizarSilencioso(); });

// Modo planilha/Make: busca novidades de tempos em tempos e ao voltar para o app
if (CONFIG.MODO !== 'local' && Number(CONFIG.ATUALIZAR_A_CADA_SEGUNDOS) > 0) {
  setInterval(sincronizarSilencioso, Number(CONFIG.ATUALIZAR_A_CADA_SEGUNDOS) * 1000);
}
document.addEventListener('visibilitychange', () => {
  if (CONFIG.MODO !== 'local' && Date.now() - API.ultimaLeitura > 15000) sincronizarSilencioso();
});

// PWA: instalação e funcionamento como app (Android/iOS)
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstalacao = e; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker não registrado', e));
}

iniciar();
