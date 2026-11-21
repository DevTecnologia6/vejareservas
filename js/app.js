// =====================================================================
//  VejaReservas — painel administrativo
// =====================================================================
import * as db from './db.js';
import './limites.js';
import { renderCalendario, MESES, toISO, addDias, datasDe, periodoTxt, saidaDate, entradaSaidaTxt, iniFim } from './calendar.js';
import { gerarPix, qrSVG } from './pix.js';
import { comprimir, abrirVisualizador } from './fotos.js';
import { htmlContrato, abrirContrato, CLAUSULAS_PADRAO, cpfFmt, cpfMascarado, cpfValido } from './contrato.js';

// ---------------------------------------------------------------- utilidades
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => toISO(new Date());
const mesChave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const nomeMes = (d) => `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const foneBR = (s) => { const d = soDigitos(s); return d.length >= 12 ? d : '55' + d; };
const foneFmt = (s) => { const d = soDigitos(s).replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d || '—'; };

function toast(msg) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

const ICO = {
  casa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>',
  din: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  pessoas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  foto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  eng: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>',
  esq: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>',
  dir: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>'
};

const STATUS = {
  pendente: { label: 'Pendente', ajuda: 'Aguardando sinal/confirmação' },
  confirmada: { label: 'Confirmada', ajuda: 'Data garantida' },
  congelada: { label: 'Congelada', ajuda: 'Cliente desistiu — crédito guardado para remarcar com prioridade' },
  concluida: { label: 'Concluída', ajuda: 'Locação já realizada' },
  cancelada: { label: 'Cancelada', ajuda: 'Não ocupa mais a data' }
};
const OCUPA = ['pendente', 'confirmada', 'concluida']; // status que bloqueiam a data no calendário
const CATEGORIAS = ['Material de limpeza', 'Produtos de piscina', 'Água', 'Luz', 'Internet', 'Gás', 'Manutenção', 'Imprevistos / danos', 'Outros'];
const FORMAS = ['Pix', 'Dinheiro', 'Cartão', 'Transferência'];
const REGRAS_PADRAO = '• A limpeza pós-evento é opcional. Sem ela, o espaço deve ser devolvido limpo e organizado.\n• A data só é garantida após a confirmação do pagamento do sinal.\n• O cancelamento pode ser solicitado em até 7 dias após a confirmação do pagamento. Depois desse prazo não é possível cancelar a reserva.';
const DIAS_CANCELAMENTO = 7;
// Prazo para o cliente pedir cancelamento: 7 dias após a confirmação (ou até o início da locação, o que vier antes)
function prazoCancelamento(r) {
  let prazo = Date.now() + DIAS_CANCELAMENTO * 864e5;
  if (r.data) { const inicio = new Date(`${r.data}T${r.horaEntrada || '00:00'}:00`).getTime(); if (inicio < prazo) prazo = inicio; }
  return prazo;
}
const fmtDataHora = (ms) => { const d = new Date(ms); return `${br(toISO(d))} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const CONFIG_PADRAO = {
  nome: 'Espaço Veja', preco12: 770, preco24: 1000, taxaLimpeza: 75, horaEntrada: '09:00', horarios: '08:00, 09:00, 10:00, 12:00, 14:00', whatsapp: '',
  preReserva: true, sinalPct: 50, prazoPagamentoMin: 30, intervaloH: 4, regras: REGRAS_PADRAO,
  pixTipo: 'celular', pixChave: '', pixNome: '', pixCidade: '',
  locadorNome: '', locadorCpf: '', locadorEndereco: '', imovelEndereco: '', foro: 'Serra/ES', clausulas: CLAUSULAS_PADRAO, assinatura: ''
};
// Cópia dos dados do contrato gravada na reserva no momento da confirmação
const contratoSnapshot = () => {
  const c = state.config;
  return { nomeEspaco: c.nome, locadorNome: c.locadorNome, locadorCpf: c.locadorCpf, locadorEndereco: c.locadorEndereco, imovelEndereco: c.imovelEndereco, foro: c.foro, clausulas: c.clausulas, assinatura: c.assinatura, geradoEm: new Date().toISOString() };
};

const datasTxt = (r) => (r?.data ? br(r.data) + ((+r.dias || 1) > 1 ? ` a ${br(addDias(r.data, r.dias - 1))}` : '') : '—');
const selo = (s) => `<span class="selo st-${s}">${STATUS[s]?.label || s}</span>`;

// ---------------------------------------------------------------- estado
const state = {
  reservas: [], despesas: [], solicitacoes: [], cancelamentos: [], config: { ...CONFIG_PADRAO },
  mesInicio: new Date(), mesFin: new Date(), mesDesp: new Date(),
  filtroStatus: 'ativas', busca: ''
};

function calc(r) {
  const total = (+r.valor || 0) + (+r.taxaLimpeza || 0);
  const recebido = (r.pagamentos || []).reduce((s, p) => s + (+p.valor || 0), 0);
  return { total, recebido, falta: Math.max(0, total - recebido) };
}

async function carregar() {
  const [reservas, despesas, cfg, sols, canc] = await Promise.all([db.list('reservas'), db.list('despesas'), db.get('config', 'geral'), db.list('solicitacoes').catch(() => []), db.list('cancelamentos').catch(() => [])]);
  state.cancelamentos = canc.filter((x) => x.status === 'pendente');
  state.reservas = reservas;
  const expiradas = sols.filter((x) => (!x.status || x.status === 'aguardando') && !x.pagoInformadoEm && x.expiraEm && Date.now() > x.expiraEm);
  state.solicitacoes = sols.filter((x) => !['recusada', 'expirada', 'cancelada'].includes(x.status) && !expiradas.includes(x)).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  state._expiradas = expiradas;
  state.despesas = despesas;
  state.config = { ...CONFIG_PADRAO, ...(cfg || {}) };
  // pré-reservas que passaram do prazo de pagamento: marca como expiradas e libera as datas
  if (state._expiradas?.length) {
    for (const x of state._expiradas) await db.update('solicitacoes', x.id, { status: 'expirada' }).catch(() => {});
    await sincronizarOcupacao(...state._expiradas.flatMap((x) => datasDe(x))).catch(() => {});
    state._expiradas = [];
  }
  // reservas confirmadas antes do recurso de contrato: grava os dados do contrato agora
  if (state.config.locadorNome) {
    for (const r of state.reservas.filter((x) => ['confirmada', 'concluida'].includes(x.status) && !x.contrato)) {
      r.contrato = contratoSnapshot();
      db.update('reservas', r.id, { contrato: r.contrato }).catch(() => {});
    }
  }
  // ocupações gravadas antes do intervalo de limpeza (sem ini/fim): grava o horário agora
  const ocup = await db.list('ocupacao').catch(() => []);
  const semHorario = ocup.filter((o) => o.id >= hoje() && !o.ini).map((o) => o.id);
  if (semHorario.length) await sincronizarOcupacao(...semHorario).catch((e) => console.warn(e));
  $('#nome-espaco').textContent = state.config.nome;
}

// { ini, fim } em ms da locação, ou null se faltar data/horário
const horarioDe = (x) => { if (!x?.data || !/^\d{2}:\d{2}$/.test(x.horaEntrada || '')) return null; const h = iniFim(x); return Number.isFinite(h.ini) ? h : null; };
// Outra reserva sobreposta ou a menos do intervalo de limpeza desta (ignora a própria)
function conflitoHorario(dados, ignorarId) {
  const h = horarioDe(dados);
  if (!h) return null;
  const folga = (+state.config.intervaloH || 0) * 3600e3;
  return state.reservas.find((x) => x.id !== ignorarId && OCUPA.includes(x.status) && (() => { const o = horarioDe(x); return o && o.fim + folga > h.ini && h.fim + folga > o.ini; })()) || null;
}

// Mantém a coleção pública "ocupacao" (só datas e horários, sem dados de clientes)
async function sincronizarOcupacao(...datas) {
  for (const data of new Set(datas.filter(Boolean))) {
    const cobre = (x) => datasDe(x).includes(data);
    const temSol = state.solicitacoes.some(cobre);
    const ocupada = temSol || state.reservas.some((r) => cobre(r) && OCUPA.includes(r.status));
    const pendente = ocupada && !state.reservas.some((r) => cobre(r) && ['confirmada', 'concluida'].includes(r.status));
    // se só há pré-reservas do site ainda não pagas, a data fica segurada só até o prazo delas
    const sols = state.solicitacoes.filter(cobre);
    const soSolsNaoPagas = !state.reservas.some((r) => cobre(r) && OCUPA.includes(r.status)) && sols.length && sols.every((x) => !x.pagoInformadoEm && x.expiraEm);
    // horário de entrada/saída (sem dados do cliente): o site usa para respeitar o intervalo de limpeza
    const hs = [...state.reservas.filter((r) => cobre(r) && OCUPA.includes(r.status)), ...sols].map(horarioDe).filter(Boolean);
    const hor = hs.length ? { ini: Math.min(...hs.map((h) => h.ini)), fim: Math.max(...hs.map((h) => h.fim)) } : {};
    if (ocupada) await db.set('ocupacao', data, soSolsNaoPagas ? { status: 'pendente', expiraEm: Math.max(...sols.map((x) => x.expiraEm)), sol: sols[0].id, ...hor } : { status: pendente ? 'pendente' : 'reservado', ...hor });
    else await db.remove('ocupacao', data).catch(() => {});
  }
}

// ---------------------------------------------------------------- navegação
const PAGINAS = {
  inicio: { titulo: 'Visão geral', menu: 'Início', ico: ICO.casa, render: renderInicio },
  reservas: { titulo: 'Reservas', menu: 'Reservas', ico: ICO.cal, render: renderReservas },
  financeiro: { titulo: 'Financeiro', menu: 'Financeiro', ico: ICO.din, render: renderFinanceiro },
  despesas: { titulo: 'Despesas', menu: 'Despesas', ico: ICO.lista, render: renderDespesas },
  clientes: { titulo: 'Clientes', menu: 'Clientes', ico: ICO.pessoas, render: renderClientes },
  fotos: { titulo: 'Fotos da casa', menu: 'Fotos', ico: ICO.foto, render: renderFotos },
  config: { titulo: 'Configurações', menu: 'Ajustes', ico: ICO.eng, render: renderConfig }
};

function montarMenus() {
  const links = Object.entries(PAGINAS).map(([k, p]) => `<a href="#${k}" data-pag="${k}">${p.ico}<span>${p.menu}</span></a>`).join('');
  $('#menu').innerHTML = links;
  $('#nav-mobile').innerHTML = links;
}

function atualizarBadge() {
  const n = state.solicitacoes.length + state.cancelamentos.length;
  $$('[data-pag="inicio"]').forEach((a) => {
    a.querySelector('.badge')?.remove();
    if (n) a.insertAdjacentHTML('beforeend', `<span class="badge">${n}</span>`);
  });
}

function rota() {
  atualizarBadge();
  const pag = PAGINAS[location.hash.slice(1)] ? location.hash.slice(1) : 'inicio';
  $$('[data-pag]').forEach((a) => a.classList.toggle('ativo', a.dataset.pag === pag));
  $('#titulo-pagina').textContent = PAGINAS[pag].titulo;
  $('#migalha-pagina').textContent = state.config.nome;
  PAGINAS[pag].render($('#conteudo'));
  window.scrollTo(0, 0);
}
const rerender = () => rota();

// ---------------------------------------------------------------- INÍCIO
function renderInicio(el) {
  const mk = mesChave(new Date());
  const doMes = state.reservas.filter((r) => r.data?.startsWith(mk) && OCUPA.includes(r.status));
  const recebidoMes = state.reservas.flatMap((r) => r.pagamentos || []).filter((p) => p.data?.startsWith(mk)).reduce((s, p) => s + +p.valor, 0);
  const aReceber = state.reservas.filter((r) => ['pendente', 'confirmada'].includes(r.status) && r.data >= hoje()).reduce((s, r) => s + calc(r).falta, 0);
  const proximas = state.reservas.filter((r) => ['pendente', 'confirmada'].includes(r.status) && r.data >= hoje()).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 5);

  el.innerHTML = '<div id="chk-aviso"></div>' + blocoCancelamentos() + blocoSolicitacoes() + `
    <div class="banner" style="background-image:url('assets/banner.jpg')">
      <img src="assets/logo.png" class="logo-img banner-logo" alt="">
      <div><div class="titulo">${esc(state.config.nome)}</div><div class="lema">Conforto &amp; Lazer</div></div>
    </div>
    <div class="kpis">
      <div class="card kpi"><div class="ico">${ICO.cal}</div><div><small>Reservas no mês</small><b>${doMes.length}</b></div></div>
      <div class="card kpi"><div class="ico">${ICO.ok}</div><div><small>Recebido no mês</small><b>${fmt(recebidoMes)}</b></div></div>
      <div class="card kpi"><div class="ico">${ICO.relogio}</div><div><small>A receber</small><b>${fmt(aReceber)}</b></div></div>
      <button class="card kpi kpi-acao" data-acao="nova-reserva"><div class="ico">${ICO.mais}</div><div><b>Nova reserva</b><small>Cadastrar evento</small></div></button>
    </div>
    <div class="duas-col">
      <div class="card">
        <div class="card-topo">
          <div><h3>Calendário de reservas</h3><div class="subtitulo-ouro" id="cal-titulo"></div></div>
          <div class="cal-nav">
            <button class="btn-icone" id="cal-ant">${ICO.esq}</button>
            <button class="btn btn-claro btn-peq" id="cal-hoje">Hoje</button>
            <button class="btn-icone" id="cal-prox">${ICO.dir}</button>
          </div>
        </div>
        <div class="cal-legenda"><span><i></i>Disponível</span><span><i class="res"></i>Reservado</span><span><i class="pen"></i>Pendente</span></div>
        <div id="cal"></div>
      </div>
      <div class="card">
        <div class="card-topo"><h3>Próximas reservas</h3><a href="#reservas" class="btn btn-claro btn-peq">Ver todas ${ICO.dir}</a></div>
        <div class="lista-res">${proximas.length ? proximas.map(itemReserva).join('') : '<div class="vazio">Nenhuma reserva futura.<br>Clique em <b>Nova reserva</b> para começar.</div>'}</div>
      </div>
    </div>`;

  const desenhar = () => {
    const marc = {};
    state.reservas.filter((r) => OCUPA.includes(r.status) && r.data).forEach((r) => {
      datasDe(r).forEach((d) => { marc[d] = r.status === 'pendente' && marc[d] !== 'reservado' ? 'pendente' : 'reservado'; });
    });
    state.solicitacoes.forEach((x) => datasDe(x).forEach((d) => { if (!marc[d]) marc[d] = 'pendente'; }));
    $('#cal-titulo').textContent = nomeMes(state.mesInicio);
    renderCalendario($('#cal'), state.mesInicio, marc, (iso, estado) => {
      if (estado === 'livre') abrirFormReserva({ data: iso });
      else { const r = state.reservas.find((x) => datasDe(x).includes(iso) && OCUPA.includes(x.status)); if (r) abrirDetalhe(r.id); else toast('Pré-reserva do site aguardando aprovação.'); }
    });
  };
  const mover = (n) => { state.mesInicio = new Date(state.mesInicio.getFullYear(), state.mesInicio.getMonth() + n, 1); desenhar(); };
  $('#cal-ant').onclick = () => mover(-1);
  $('#cal-prox').onclick = () => mover(1);
  $('#cal-hoje').onclick = () => { state.mesInicio = new Date(); desenhar(); };
  desenhar();
  ligarItens(el);
  ligarSolicitacoes(el); ligarCancelamentos(el);
  verificarSistema().then((itens) => {
    const pend = itens.filter((i) => !i.ok);
    if (!pend.length || !$('#chk-aviso')) return;
    $('#chk-aviso').innerHTML = `<div class="card" style="margin-bottom:18px;border-color:#f0d9a8;background:var(--laranja-bg);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><b>⚙️ Configuração: ${itens.length - pend.length} de ${itens.length} itens prontos</b><br><small style="color:#7a4d05">Falta: ${pend.map((i) => esc(i.t)).join(', ')}</small></div>
      <a href="#config" class="btn btn-ouro btn-peq">Ver checklist</a></div>`;
  });
}

function blocoSolicitacoes() {
  if (!state.solicitacoes.length) return '';
  return `<div class="card solic">
    <div class="card-topo"><div><h3>Pré-reservas feitas pelo site</h3><small style="color:var(--cinza)">Confira o pagamento e aprove para virar reserva.</small></div><span class="badge" style="margin:0;font-size:13px;padding:3px 10px">${state.solicitacoes.length}</span></div>
    <div class="lista-res">${state.solicitacoes.map((x) => `
      <div class="item-res">
        <div class="ico">${ICO.cal}</div>
        <div class="meio"><b>${esc(x.cliente)}</b>${x.extensao ? ' <span class="selo st-pendente">⏱ Pedido de mais tempo</span>' : ''}<small>${x.extensao ? `${esc(x.obs)} · reserva passa a ser ` : ''}${datasTxt(x)} —${esc(x.evento || 'Evento')} · ${periodoTxt(x)}${x.horaEntrada ? ' · ' + entradaSaidaTxt(x) : ''} · <b style="display:inline;font-size:13px;color:var(--ouro-esc)">${esc(x.codigo)}</b></small>
          <small style="display:block;margin:2px 0">${x.pagoInformadoEm ? '<span class="selo st-confirmada">💰 Cliente informou o pagamento — confira o Pix</span>' : x.expiraEm ? `<span class="selo st-pendente">⏳ Aguardando pagamento · expira às ${new Date(x.expiraEm).toTimeString().slice(0, 5)}</span>` : ''}</small>
          <small style="display:block">${foneFmt(x.telefone)}${x.email ? ` · ${esc(x.email)}` : ''}${x.sinal ? ` · sinal via Pix: ${fmt(x.sinal)}` : ''}${x.obs ? ` · ${esc(x.obs)}` : ''}</small></div>
        <div class="dir"><b style="margin:0 0 8px">${fmt(x.total)}</b><div class="acoes">
          <a class="btn btn-verde btn-peq" target="_blank" rel="noopener" title="WhatsApp" href="https://wa.me/${foneBR(x.telefone)}?text=${encodeURIComponent(`Olá, ${x.cliente.split(' ')[0]}! Recebemos sua pré-reserva ${x.codigo} do ${state.config.nome} para ${br(x.data)}.`)}">${ICO.zap}</a>
          <button class="btn btn-perigo btn-peq" data-recusar="${x.id}">Recusar</button>
          <button class="btn btn-ouro btn-peq" data-aprovar="${x.id}">Aprovar</button></div></div>
      </div>`).join('')}</div></div>`;
}

function blocoCancelamentos() {
  if (!state.cancelamentos.length) return '';
  return `<div class="card solic" style="border-color:#efc2bd;background:linear-gradient(180deg,#fff6f5,#fff)">
    <div class="card-topo"><div><h3>Pedidos de cancelamento</h3><small style="color:var(--cinza)">Feitos pelo cliente dentro do prazo de ${DIAS_CANCELAMENTO} dias.</small></div><span class="badge" style="margin:0;font-size:13px;padding:3px 10px">${state.cancelamentos.length}</span></div>
    <div class="lista-res">${state.cancelamentos.map((x) => {
      const r = state.reservas.find((y) => y.id === x.id);
      const c = r ? calc(r) : null;
      return `<div class="item-res">
        <div class="ico" style="background:var(--vermelho-bg);color:var(--vermelho)">${ICO.cal}</div>
        <div class="meio"><b>${esc(x.cliente || r?.cliente || 'Cliente')}</b><small>${br(x.data || r?.data)} · pedido em ${br(String(x.criadoEm).slice(0, 10))}${c ? ` · já pago ${fmt(c.recebido)}` : ''}</small>
          ${x.motivo ? `<small style="display:block">Motivo: ${esc(x.motivo)}</small>` : ''}</div>
        <div class="dir"><div class="acoes">
          ${r ? `<button class="btn btn-claro btn-peq" data-vercanc="${x.id}">Ver reserva</button>` : ''}
          <button class="btn btn-claro btn-peq" data-recusarcanc="${x.id}">Recusar</button>
          <button class="btn btn-perigo btn-peq" data-aceitarcanc="${x.id}">Aceitar cancelamento</button></div></div>
      </div>`;
    }).join('')}</div></div>`;
}

function ligarCancelamentos(el) {
  $$('[data-vercanc]', el).forEach((b) => (b.onclick = () => abrirDetalhe(b.dataset.vercanc)));
  $$('[data-recusarcanc]', el).forEach((b) => (b.onclick = async () => {
    if (!confirm('Recusar este pedido de cancelamento? A reserva continua valendo.')) return;
    await db.update('cancelamentos', b.dataset.recusarcanc, { status: 'recusado' });
    state.cancelamentos = state.cancelamentos.filter((x) => x.id !== b.dataset.recusarcanc);
    toast('Pedido recusado.'); rerender();
  }));
  $$('[data-aceitarcanc]', el).forEach((b) => (b.onclick = async () => {
    const id = b.dataset.aceitarcanc;
    const r = state.reservas.find((y) => y.id === id);
    if (!confirm('Aceitar o cancelamento? A reserva será marcada como cancelada e a data volta a ficar livre. Se houver reembolso, faça pelo seu banco.')) return;
    if (r) { await db.update('reservas', id, { status: 'cancelada' }); r.status = 'cancelada'; await sincronizarOcupacao(...datasDe(r)); }
    await db.update('cancelamentos', id, { status: 'aceito' });
    state.cancelamentos = state.cancelamentos.filter((x) => x.id !== id);
    toast('Reserva cancelada.'); rerender();
  }));
}

function ligarSolicitacoes(el) {
  $$('[data-aprovar]', el).forEach((b) => (b.onclick = () => {
    const x = state.solicitacoes.find((s) => s.id === b.dataset.aprovar);
    if (x.extensao) return aprovarExtensao(x);
    abrirFormReserva({
      cliente: x.cliente, telefone: x.telefone, data: x.data, dias: x.dias || 1, meia: !!x.meia, periodo: x.periodo, evento: x.evento, horaEntrada: x.horaEntrada || state.config.horaEntrada,
      valor: x.valor, taxaLimpeza: x.taxaLimpeza, status: x.sinal ? 'confirmada' : 'pendente',
      obs: [`Pré-reserva ${x.codigo} (site)`, x.obs].filter(Boolean).join(' — '),
      clienteCpf: x.clienteCpf || '', clienteEndereco: x.clienteEndereco || '',
      _sol: x.id, _sinal: x.sinal, _clienteUid: x.uid, _clienteEmail: x.email, _aceite: x.aceiteContrato
    });
  }));
  $$('[data-recusar]', el).forEach((b) => (b.onclick = async () => {
    const x = state.solicitacoes.find((s) => s.id === b.dataset.recusar);
    if (!confirm(`Recusar a pré-reserva de ${x.cliente} (${br(x.data)})? A data volta a ficar livre no calendário.`)) return;
    await db.update('solicitacoes', x.id, { status: 'recusada' }); // o cliente vê "Não aprovada" na conta dele
    state.solicitacoes = state.solicitacoes.filter((s) => s.id !== x.id);
    await sincronizarOcupacao(...datasDe(x));
    toast('Pré-reserva recusada.'); rerender();
  }));
}

// Pedido de mais tempo feito pelo cliente: amplia a reserva original e lança o Pix pago
async function aprovarExtensao(x) {
  const r = state.reservas.find((y) => y.id === x.extensao);
  if (!r) return toast('A reserva original não foi encontrada. Recuse o pedido e fale com o cliente.');
  const forma = { dias: +x.dias || 1, periodo: x.periodo, meia: !!x.meia };
  const nova = { ...r, ...forma };
  const conflito = conflitoHorario(nova, r.id);
  const saida = saidaDate(nova);
  const msg = `Aprovar o pedido de ${x.cliente}: ${x.obs}?\n\nA reserva passa de ${periodoTxt(r)} para ${periodoTxt(nova)}, com saída em ${saida ? fmtDataHora(saida.getTime()) : '—'}, e o valor da locação vai de ${fmt(r.valor)} para ${fmt(+r.valor + +x.valor)}.`
    + (x.sinal ? ` O Pix de ${fmt(x.sinal)} será lançado como pagamento (confira se caiu).` : '')
    + (conflito ? `\n\n⚠ Atenção: fica a menos de ${state.config.intervaloH || 0}h (ou sobreposto) da reserva de ${conflito.cliente} (${datasTxt(conflito)}).` : '');
  if (!confirm(msg)) return;
  const dados = {
    ...forma, valor: (+r.valor || 0) + (+x.valor || 0),
    pagamentos: [...(r.pagamentos || []), ...(x.sinal ? [{ valor: +x.sinal, data: hoje(), forma: 'Pix' }] : [])],
    obs: [r.obs, `${x.obs} (${x.codigo}, site)`].filter(Boolean).join(' — ')
  };
  try {
    await db.update('reservas', r.id, dados); Object.assign(r, dados);
    await db.remove('solicitacoes', x.id);
    state.solicitacoes = state.solicitacoes.filter((s) => s.id !== x.id);
    await sincronizarOcupacao(...datasDe(r));
    toast('Extensão aprovada!'); rerender();
  } catch (e) { console.error(e); toast('Erro ao aprovar: ' + (e.message || e)); }
}

function itemReserva(r) {
  const c = calc(r);
  return `<div class="item-res" data-id="${r.id}">
    <div class="ico">${ICO.cal}</div>
    <div class="meio"><b>${esc(r.cliente)}</b><small>${datasTxt(r)} — ${esc(r.evento || 'Evento')} · ${periodoTxt(r)}</small></div>
    <div class="dir">${selo(r.status)}<b>${fmt(c.total)}</b>${c.falta > 0 && r.status !== 'cancelada' ? `<small style="color:var(--laranja);font-size:12px">falta ${fmt(c.falta)}</small>` : ''}</div>
  </div>`;
}
const ligarItens = (el) => $$('.item-res', el).forEach((i) => (i.onclick = () => abrirDetalhe(i.dataset.id)));

// ---------------------------------------------------------------- RESERVAS
function renderReservas(el) {
  const filtros = { ativas: 'Próximas', todas: 'Todas', pendente: 'Pendentes', confirmada: 'Confirmadas', congelada: 'Congeladas', concluida: 'Concluídas', cancelada: 'Canceladas' };
  el.innerHTML = blocoCancelamentos() + blocoSolicitacoes() + `
    <div class="card">
      <div class="filtros"><input id="busca" placeholder="Buscar por cliente, telefone ou evento…" value="${esc(state.busca)}"></div>
      <div class="chips" style="margin-bottom:10px">${Object.entries(filtros).map(([k, v]) => `<button class="chip ${state.filtroStatus === k ? 'ativo' : ''}" data-f="${k}">${v}</button>`).join('')}</div>
      <div class="lista-res" id="lista"></div>
    </div>`;
  const desenhar = () => {
    const q = state.busca.toLowerCase();
    let lista = state.reservas.filter((r) => {
      if (state.filtroStatus === 'ativas') return ['pendente', 'confirmada'].includes(r.status) && r.data >= hoje();
      if (state.filtroStatus === 'todas') return true;
      return r.status === state.filtroStatus;
    }).filter((r) => !q || [r.cliente, r.telefone, r.evento].some((v) => String(v || '').toLowerCase().includes(q)));
    const asc = state.filtroStatus === 'ativas';
    lista.sort((a, b) => (asc ? 1 : -1) * String(a.data || '9999').localeCompare(String(b.data || '9999')));
    $('#lista').innerHTML = lista.length ? lista.map(itemReserva).join('') : '<div class="vazio">Nenhuma reserva encontrada.</div>';
    ligarItens($('#lista'));
  };
  ligarSolicitacoes(el); ligarCancelamentos(el);
  $('#busca').oninput = (e) => { state.busca = e.target.value; desenhar(); };
  $$('.chip', el).forEach((c) => (c.onclick = () => { state.filtroStatus = c.dataset.f; $$('.chip', el).forEach((x) => x.classList.toggle('ativo', x === c)); desenhar(); }));
  desenhar();
}

// ---------------------------------------------------------------- modal
function abrirModal(titulo, corpo, aoMontar) {
  const raiz = $('#modal-raiz');
  raiz.innerHTML = `<div class="modal-fundo"><div class="modal" role="dialog">
    <div class="modal-topo"><h3>${titulo}</h3><button class="btn-icone" data-fechar>${ICO.x}</button></div>
    <div class="modal-corpo">${corpo}</div></div></div>`;
  const fundo = $('.modal-fundo', raiz);
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fecharModal(); });
  $('[data-fechar]', raiz).onclick = fecharModal;
  aoMontar && aoMontar($('.modal', raiz));
}
const fecharModal = () => ($('#modal-raiz').innerHTML = '');
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

// ---------------------------------------------------------------- form reserva
function abrirFormReserva(r = {}) {
  const novo = !r.id;
  const cfg = state.config;
  const v = { periodo: '24h', dias: 1, horaEntrada: cfg.horaEntrada, status: 'pendente', taxaLimpeza: 0, ...r };
  if (v.valor == null) v.valor = (v.periodo === '12h' ? cfg.preco12 : cfg.preco24 * (+v.dias || 1)) + (v.meia ? +cfg.preco12 : 0);

  abrirModal(novo ? 'Nova reserva' : 'Editar reserva', `
    <form id="form-res" class="grade-form">
      <label class="campo inteiro">Nome do cliente<input name="cliente" required value="${esc(v.cliente)}"></label>
      <label class="campo">WhatsApp / telefone<input name="telefone" inputmode="tel" placeholder="(27) 99999-9999" value="${esc(foneFmt(v.telefone) === '—' ? '' : foneFmt(v.telefone))}"></label>
      <label class="campo">CPF do cliente (para o contrato)<input name="clienteCpf" inputmode="numeric" placeholder="000.000.000-00" value="${esc(cpfFmt(v.clienteCpf))}"></label>
      <label class="campo">Endereço do cliente<input name="clienteEndereco" placeholder="Rua, nº, bairro, cidade" value="${esc(v.clienteEndereco)}"></label>
      <label class="campo">Tipo de evento<input name="evento" list="eventos" placeholder="Aniversário, churrasco…" value="${esc(v.evento)}">
        <datalist id="eventos"><option>Aniversário</option><option>Confraternização</option><option>Chá de bebê</option><option>Churrasco</option><option>Casamento</option><option>Day use</option></datalist></label>
      <label class="campo">Data de entrada (1º dia)${v.status === 'congelada' ? ' — opcional se congelada' : ''}<input type="date" name="data" value="${esc(v.data)}"></label>
      <label class="campo">Último dia (para várias datas)<input type="date" name="dataFim" value="${esc(v.data ? addDias(v.data, (+v.dias || 1) - 1) : '')}"><span class="horario-info">Deixe igual à entrada para 1 dia</span></label>
      <label class="campo">Período
        <select name="periodo"><option value="24h" ${v.periodo === '24h' ? 'selected' : ''}>24 horas (diária)</option><option value="12h" ${v.periodo === '12h' ? 'selected' : ''}>12 horas</option></select></label>
      <label class="campo">Quantidade de diárias<input type="number" name="dias" min="1" max="30" value="${+v.dias || 1}"><span class="horario-info" id="dias-info"></span></label>
      <label class="campo">+ Meia diária (12h) no final
        <span style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" name="meia" ${v.meia ? 'checked' : ''} style="width:20px;height:20px;flex-shrink:0"> Ex.: 3 diárias + 12h = 3 dias e meio</span></label>
      <label class="campo">Horário de entrada<input type="time" name="horaEntrada" value="${esc(v.horaEntrada)}"><span class="horario-info" id="saida-prev"></span></label>
      <label class="campo">Status
        <select name="status">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      <label class="campo">Valor da locação (R$)<input type="number" step="0.01" min="0" name="valor" value="${v.valor}"></label>
      <label class="campo">Limpeza pós-evento (opcional)
        <span style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="querLimpeza" ${+v.taxaLimpeza > 0 ? 'checked' : ''} style="width:20px;height:20px;flex-shrink:0">
        <input type="number" step="0.01" min="0" name="taxaLimpeza" value="${v.taxaLimpeza}" ${+v.taxaLimpeza > 0 ? '' : 'disabled'}></span></label>
      ${novo ? `
      <label class="campo">Sinal já recebido (R$)<input type="number" step="0.01" min="0" name="sinal" placeholder="0,00" value="${v._sinal || ''}"></label>
      <label class="campo">Forma do sinal<select name="formaSinal">${FORMAS.map((f) => `<option>${f}</option>`).join('')}</select></label>` : ''}
      <label class="campo inteiro">Observações<textarea name="obs" placeholder="Nº de convidados, pedidos especiais…">${esc(v.obs)}</textarea></label>
      <div class="inteiro box-valores" style="margin:0"><div class="resumo-linha total"><span>Total</span><span id="total-prev"></span></div></div>
      <div class="erro inteiro" id="res-erro"></div>
      <div class="modal-acoes inteiro" style="margin-top:0">
        <button type="button" class="btn btn-claro" data-fechar2>Cancelar</button>
        <button class="btn btn-ouro" type="submit">${novo ? 'Salvar reserva' : 'Salvar alterações'}</button>
      </div>
    </form>`, (m) => {
    const f = $('#form-res', m);
    const atualizarTotal = () => ($('#total-prev', m).textContent = fmt((+f.valor.value || 0) + (f.querLimpeza.checked ? +f.taxaLimpeza.value || 0 : 0)));
    const recalcular = () => {
      if (+f.dias.value > 1 || f.meia.checked) f.periodo.value = '24h';
      f.periodo.disabled = +f.dias.value > 1 || f.meia.checked;
      f.valor.value = (f.periodo.value === '12h' ? cfg.preco12 : cfg.preco24 * Math.max(1, +f.dias.value || 1)) + (f.meia.checked ? +cfg.preco12 : 0);
      $('#dias-info', m).textContent = (+f.dias.value > 1 ? `${f.dias.value} × ${fmt(cfg.preco24)}` : '') + (f.meia.checked ? ` + 12h ${fmt(cfg.preco12)}` : '');
      atualizarTotal(); atualizarSaida();
    };
    f.periodo.onchange = recalcular; f.meia.onchange = recalcular;
    const diff = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
    f.dias.oninput = () => { if (f.data.value) f.dataFim.value = addDias(f.data.value, Math.max(1, +f.dias.value || 1) - 1); recalcular(); };
    f.dataFim.oninput = () => {
      if (!f.data.value || !f.dataFim.value) return;
      if (f.dataFim.value < f.data.value) f.dataFim.value = f.data.value;
      f.dias.value = Math.min(30, diff(f.data.value, f.dataFim.value) + 1); recalcular();
    };
    f.data.addEventListener('input', () => { if (f.data.value) f.dataFim.value = addDias(f.data.value, Math.max(1, +f.dias.value || 1) - 1); recalcular(); });
    f.periodo.disabled = +f.dias.value > 1 || f.meia.checked;
    f.valor.oninput = f.taxaLimpeza.oninput = atualizarTotal;
    const atualizarSaida = () => {
      const el = $('#saida-prev', m);
      if (!f.data.value || !f.horaEntrada.value) return (el.textContent = '');
      const [h, mi] = f.horaEntrada.value.split(':').map(Number);
      const d = saidaDate({ data: f.data.value, horaEntrada: f.horaEntrada.value, periodo: f.periodo.value, dias: +f.dias.value || 1, meia: f.meia.checked });
      el.innerHTML = `Saída prevista: <b>${br(toISO(d))} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</b>`;
    };
    f.data.addEventListener('input', atualizarSaida); f.horaEntrada.addEventListener('input', atualizarSaida); f.periodo.addEventListener('change', atualizarSaida);
    atualizarSaida();
    f.querLimpeza.onchange = () => {
      f.taxaLimpeza.disabled = !f.querLimpeza.checked;
      f.taxaLimpeza.value = f.querLimpeza.checked ? (+f.taxaLimpeza.value || cfg.taxaLimpeza) : 0;
      atualizarTotal();
    };
    atualizarTotal();
    $('[data-fechar2]', m).onclick = fecharModal;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const nDias = Math.min(30, Math.max(1, +d.dias || 1));
      const dados = {
        dias: nDias, meia: !!d.meia,
        cliente: d.cliente.trim(), telefone: soDigitos(d.telefone), evento: d.evento.trim(), data: d.data || '',
        periodo: nDias > 1 || d.meia ? '24h' : f.periodo.value, horaEntrada: d.horaEntrada, status: d.status, valor: +d.valor || 0,
        taxaLimpeza: d.querLimpeza ? +d.taxaLimpeza || 0 : 0, obs: d.obs.trim(),
        clienteCpf: soDigitos(d.clienteCpf), clienteEndereco: (d.clienteEndereco || '').trim()
      };
      if (dados.clienteCpf && !cpfValido(dados.clienteCpf)) return ($('#res-erro', m).textContent = 'CPF do cliente inválido.');
      if (!dados.data && dados.status !== 'congelada') return ($('#res-erro', m).textContent = 'Informe a data (só reservas congeladas podem ficar sem data).');
      if (dados.data && OCUPA.includes(dados.status)) {
        const minhas = datasDe(dados);
        const choque = state.reservas.find((x) => x.id !== r.id && OCUPA.includes(x.status) && datasDe(x).some((d) => minhas.includes(d)));
        if (choque && !confirm(`Atenção: essas datas coincidem com a reserva de ${choque.cliente} (${datasTxt(choque)}). Salvar mesmo assim?`)) return;
        const colada = !choque && conflitoHorario(dados, r.id);
        if (colada && !confirm(`Atenção: este horário fica a menos de ${state.config.intervaloH || 0}h da reserva de ${colada.cliente} (${datasTxt(colada)} · ${entradaSaidaTxt(colada)}). Não sobra o intervalo para a limpeza. Salvar mesmo assim?`)) return;
      }
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        if (novo) {
          dados.pagamentos = +d.sinal > 0 ? [{ valor: +d.sinal, data: hoje(), forma: d.formaSinal }] : [];
          dados.criadoEm = `${hoje()}T${new Date().toTimeString().slice(0, 8)}`;
          if (r._clienteUid) { dados.clienteUid = r._clienteUid; dados.clienteEmail = r._clienteEmail || ''; }
          if (r._aceite) dados.aceiteContrato = r._aceite;
          if (dados.status === 'confirmada') { dados.prazoCancelamento = prazoCancelamento(dados); dados.contrato = contratoSnapshot(); }
          const id = await db.add('reservas', dados);
          state.reservas.push({ id, ...dados });
          if (r._sol) {
            await db.remove('solicitacoes', r._sol);
            state.solicitacoes = state.solicitacoes.filter((s) => s.id !== r._sol);
          }
        } else {
          if (dados.status === 'confirmada' && !r.prazoCancelamento) dados.prazoCancelamento = prazoCancelamento(dados);
          if (dados.status === 'confirmada' && !r.contrato) dados.contrato = contratoSnapshot();
          await db.update('reservas', r.id, dados);
          Object.assign(state.reservas.find((x) => x.id === r.id), dados);
        }
        await sincronizarOcupacao(...datasDe(dados), ...datasDe(r));
        fecharModal(); toast(novo ? 'Reserva cadastrada!' : 'Reserva atualizada!'); rerender();
      } catch (err) {
        console.error(err); btn.disabled = false; btn.textContent = 'Tentar de novo';
        $('#res-erro', m).textContent = 'Erro ao salvar: ' + (err.message || err);
      }
    };
  });
}

// ---------------------------------------------------------------- detalhe
function abrirDetalhe(id) {
  const r = state.reservas.find((x) => x.id === id);
  if (!r) return;
  const c = calc(r);
  const saida = (() => { const dt = saidaDate(r); return dt ? fmtDataHora(dt.getTime()) : ''; })();
  const msgCliente = encodeURIComponent(`Olá, ${r.cliente.split(' ')[0]}! Aqui é do ${state.config.nome}. Sobre a sua reserva de ${datasTxt(r)} (${periodoTxt(r)}, ${entradaSaidaTxt(r)})` + (c.falta > 0 ? `, fica um saldo de ${fmt(c.falta)} a acertar.` : '. Está tudo certo! 😊'));

  abrirModal(esc(r.cliente), `
    <div style="margin-bottom:14px">${selo(r.status)} <small style="color:var(--cinza);margin-left:6px">${STATUS[r.status]?.ajuda || ''}</small></div>
    <div class="det-grade">
      <div><small>Data${(+r.dias || 1) > 1 ? 's' : ''}</small><b>${datasTxt(r)}</b></div>
      <div><small>Período</small><b>${periodoTxt(r)}${r.horaEntrada ? ' · ' + entradaSaidaTxt(r) : ''}</b></div>
      <div><small>Saída prevista</small><b>${saida || '—'}</b></div>
      ${r.prazoCancelamento ? `<div><small>Cliente pode cancelar até</small><b class="${Date.now() > r.prazoCancelamento ? 'negativo' : ''}">${fmtDataHora(r.prazoCancelamento)}${Date.now() > r.prazoCancelamento ? ' (encerrado)' : ''}</b></div>` : ''}
      <div><small>Evento</small><b>${esc(r.evento || '—')}</b></div>
      <div><small>Telefone</small><b>${foneFmt(r.telefone)}</b></div>
      ${r.clienteCpf ? `<div><small>CPF</small><b>${cpfFmt(r.clienteCpf)}</b></div>` : ''}
      ${r.clienteEndereco ? `<div><small>Endereço</small><b>${esc(r.clienteEndereco)}</b></div>` : ''}
      ${r.aceiteContrato ? `<div><small>Contrato aceito pelo cliente</small><b>${new Date(r.aceiteContrato).toLocaleString('pt-BR').slice(0, 17)}</b></div>` : ''}
      ${r.clienteEmail ? `<div><small>Conta do cliente</small><b>${esc(r.clienteEmail)}</b></div>` : ''}
      <div><small>Cadastrada em</small><b>${r.criadoEm ? br(r.criadoEm.slice(0, 10)) : '—'}</b></div>
      ${r.obs ? `<div style="grid-column:1/-1"><small>Observações</small><b style="font-weight:500">${esc(r.obs)}</b></div>` : ''}
    </div>
    <div class="box-valores">
      <div class="resumo-linha"><span>Locação</span><span>${fmt(r.valor)}</span></div>
      <div class="resumo-linha"><span>Taxa de limpeza</span><span>${fmt(r.taxaLimpeza)}</span></div>
      <div class="resumo-linha total"><span>Total</span><span>${fmt(c.total)}</span></div>
      <div class="resumo-linha"><span>Recebido</span><span class="positivo">${fmt(c.recebido)}</span></div>
      <div class="resumo-linha total"><span>Falta receber</span><span class="${c.falta > 0 ? 'negativo' : 'positivo'}">${fmt(c.falta)}</span></div>
    </div>
    <h4 style="margin-bottom:8px">Pagamentos</h4>
    ${(r.pagamentos || []).length ? `<table class="tabela"><tbody>${r.pagamentos.map((p, i) => `
      <tr><td>${br(p.data)}</td><td>${esc(p.forma)}</td><td class="num">${fmt(p.valor)}</td>
      <td class="num"><button class="btn btn-perigo btn-peq" data-delpag="${i}">Remover</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="vazio" style="padding:12px">Nenhum pagamento registrado.</div>'}
    <div class="modal-acoes">
      <button class="btn btn-perigo" id="d-excluir">Excluir</button>
      ${r.telefone ? `<a class="btn btn-verde" target="_blank" rel="noopener" href="https://wa.me/${foneBR(r.telefone)}?text=${msgCliente}">${ICO.zap} WhatsApp</a>` : ''}
      <button class="btn btn-claro" id="d-contrato">📄 Contrato</button>
      <button class="btn btn-claro" id="d-editar">Editar</button>
      ${c.falta > 0 ? '<button class="btn btn-ouro" id="d-pagar">Registrar pagamento</button>' : ''}
    </div>`, (m) => {
    $('#d-editar', m).onclick = () => abrirFormReserva(r);
    $('#d-contrato', m).onclick = () => abrirContrato(htmlContrato(r, r.contrato || contratoSnapshot()), `Contrato - ${r.cliente} - ${br(r.data)}`);
    $('#d-pagar', m) && ($('#d-pagar', m).onclick = () => abrirPagamento(r));
    $('#d-excluir', m).onclick = async () => {
      if (!confirm(`Excluir a reserva de ${r.cliente}? Isso não pode ser desfeito.`)) return;
      await db.remove('reservas', r.id);
      state.reservas = state.reservas.filter((x) => x.id !== r.id);
      await sincronizarOcupacao(...datasDe(r));
      fecharModal(); toast('Reserva excluída.'); rerender();
    };
    $$('[data-delpag]', m).forEach((b) => (b.onclick = async () => {
      if (!confirm('Remover este pagamento?')) return;
      const pagamentos = r.pagamentos.filter((_, i) => i !== +b.dataset.delpag);
      await db.update('reservas', r.id, { pagamentos });
      r.pagamentos = pagamentos; abrirDetalhe(r.id); rerender();
    }));
  });
}

function abrirPagamento(r) {
  const c = calc(r);
  abrirModal(`Pagamento · ${esc(r.cliente)}`, `
    <form id="form-pag" class="grade-form">
      <label class="campo">Valor (R$)<input type="number" step="0.01" min="0.01" name="valor" required value="${c.falta.toFixed(2)}"></label>
      <label class="campo">Data<input type="date" name="data" required value="${hoje()}"></label>
      <label class="campo inteiro">Forma de pagamento<select name="forma">${FORMAS.map((f) => `<option>${f}</option>`).join('')}</select></label>
      <label class="campo inteiro" style="flex-direction:row;display:flex;gap:8px;align-items:center;font-weight:500">
        <input type="checkbox" name="confirmar" ${r.status === 'pendente' ? 'checked' : ''} style="width:auto"> Marcar reserva como confirmada</label>
      <div class="modal-acoes inteiro"><button type="button" class="btn btn-claro" id="p-voltar">Voltar</button><button class="btn btn-ouro">Registrar</button></div>
    </form>`, (m) => {
    $('#p-voltar', m).onclick = () => abrirDetalhe(r.id);
    $('#form-pag', m).onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      const pagamentos = [...(r.pagamentos || []), { valor: +d.valor, data: d.data, forma: d.forma }];
      const upd = { pagamentos };
      if (d.confirmar && r.status === 'pendente') upd.status = 'confirmada';
      if ((upd.status || r.status) === 'confirmada' && !r.prazoCancelamento) upd.prazoCancelamento = prazoCancelamento(r);
      if ((upd.status || r.status) === 'confirmada' && !r.contrato) upd.contrato = contratoSnapshot();
      await db.update('reservas', r.id, upd);
      Object.assign(r, upd);
      await sincronizarOcupacao(...datasDe(r));
      toast('Pagamento registrado!'); abrirDetalhe(r.id); rerender();
    };
  });
}

// ---------------------------------------------------------------- FINANCEIRO
function seletorMes(id, d) {
  return `<div class="seletor-mes"><button data-m="-1" data-sel="${id}">${ICO.esq}</button><b>${nomeMes(d)}</b><button data-m="1" data-sel="${id}">${ICO.dir}</button></div>`;
}
function ligarSeletor(el, chave) {
  $$(`[data-sel="${chave}"]`, el).forEach((b) => (b.onclick = () => {
    const d = state[chave]; state[chave] = new Date(d.getFullYear(), d.getMonth() + +b.dataset.m, 1); rerender();
  }));
}

function totaisMes(mk) {
  const recebido = state.reservas.flatMap((r) => r.pagamentos || []).filter((p) => p.data?.startsWith(mk)).reduce((s, p) => s + +p.valor, 0);
  const despesas = state.despesas.filter((d) => d.data?.startsWith(mk)).reduce((s, d) => s + +d.valor, 0);
  return { recebido, despesas, lucro: recebido - despesas };
}

function renderFinanceiro(el) {
  const mk = mesChave(state.mesFin);
  const t = totaisMes(mk);
  const pagMes = state.reservas.flatMap((r) => (r.pagamentos || []).map((p) => ({ ...p, cliente: r.cliente, id: r.id }))).filter((p) => p.data?.startsWith(mk)).sort((a, b) => b.data.localeCompare(a.data));
  const pendentes = state.reservas.filter((r) => ['pendente', 'confirmada'].includes(r.status) && calc(r).falta > 0).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const totalPend = pendentes.reduce((s, r) => s + calc(r).falta, 0);
  const congeladas = state.reservas.filter((r) => r.status === 'congelada');
  const creditoCong = congeladas.reduce((s, r) => s + calc(r).recebido, 0);

  // últimos 6 meses
  const meses = [...Array(6)].map((_, i) => { const d = new Date(state.mesFin.getFullYear(), state.mesFin.getMonth() - 5 + i, 1); return { d, ...totaisMes(mesChave(d)) }; });
  const max = Math.max(1, ...meses.flatMap((x) => [x.recebido, x.despesas]));

  el.innerHTML = `
    <div style="margin-bottom:16px">${seletorMes('mesFin', state.mesFin)}</div>
    <div class="kpis">
      <div class="card kpi"><div class="ico">${ICO.ok}</div><div><small>Recebido no mês</small><b>${fmt(t.recebido)}</b></div></div>
      <div class="card kpi"><div class="ico">${ICO.lista}</div><div><small>Despesas do mês</small><b>${fmt(t.despesas)}</b></div></div>
      <div class="card kpi"><div class="ico">${ICO.din}</div><div><small>Lucro do mês</small><b class="${t.lucro >= 0 ? 'positivo' : 'negativo'}">${fmt(t.lucro)}</b></div></div>
      <div class="card kpi"><div class="ico">${ICO.relogio}</div><div><small>Total a receber</small><b>${fmt(totalPend)}</b></div></div>
    </div>
    <div class="duas-col">
      <div class="card">
        <div class="card-topo"><h3>Últimos 6 meses</h3><div class="cal-legenda" style="margin:0"><span><i class="res"></i>Recebido</span><span><i style="background:#e2c9c5;border-color:#e2c9c5"></i>Despesas</span></div></div>
        <div class="grafico-meses">${meses.map((x) => `<div class="gm-col" title="${nomeMes(x.d)}: recebido ${fmt(x.recebido)} · despesas ${fmt(x.despesas)}">
          <div class="gm-barras"><div class="gm-rec" style="height:${(x.recebido / max) * 100}%"></div><div class="gm-desp" style="height:${(x.despesas / max) * 100}%"></div></div>
          <small>${MESES[x.d.getMonth()].slice(0, 3)}</small></div>`).join('')}</div>
      </div>
      <div class="card">
        <div class="card-topo"><h3>Valores pendentes</h3><b>${fmt(totalPend)}</b></div>
        <div class="lista-res">${pendentes.length ? pendentes.map(itemReserva).join('') : '<div class="vazio">Nada pendente. Tudo recebido! 🎉</div>'}</div>
        ${congeladas.length ? `<div class="box-valores" style="margin:12px 0 0"><div class="resumo-linha"><span>Créditos de reservas congeladas (${congeladas.length})</span><b>${fmt(creditoCong)}</b></div></div>` : ''}
      </div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="card-topo"><h3>Pagamentos recebidos em ${nomeMes(state.mesFin)}</h3></div>
      ${pagMes.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Cliente</th><th>Forma</th><th class="num">Valor</th></tr></thead><tbody>
        ${pagMes.map((p) => `<tr class="item-pag" data-id="${p.id}" style="cursor:pointer"><td>${br(p.data)}</td><td>${esc(p.cliente)}</td><td>${esc(p.forma)}</td><td class="num">${fmt(p.valor)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="vazio">Nenhum pagamento neste mês.</div>'}
    </div>`;
  ligarSeletor(el, 'mesFin');
  ligarItens(el);
  $$('.item-pag', el).forEach((tr) => (tr.onclick = () => abrirDetalhe(tr.dataset.id)));
}

// ---------------------------------------------------------------- DESPESAS
function renderDespesas(el) {
  const mk = mesChave(state.mesDesp);
  const lista = state.despesas.filter((d) => d.data?.startsWith(mk)).sort((a, b) => b.data.localeCompare(a.data));
  const total = lista.reduce((s, d) => s + +d.valor, 0);
  const porCat = CATEGORIAS.map((c) => ({ c, v: lista.filter((d) => d.categoria === c).reduce((s, d) => s + +d.valor, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const maxCat = Math.max(1, ...porCat.map((x) => x.v));

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      ${seletorMes('mesDesp', state.mesDesp)}
      <button class="btn btn-ouro" id="nova-desp">${ICO.mais} Nova despesa</button>
    </div>
    <div class="duas-col">
      <div class="card">
        <div class="card-topo"><h3>Lançamentos</h3><b>${fmt(total)}</b></div>
        ${lista.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="num">Valor</th><th></th></tr></thead><tbody>
          ${lista.map((d) => `<tr><td>${br(d.data)}</td><td>${esc(d.categoria)}</td><td>${esc(d.descricao)}</td><td class="num">${fmt(d.valor)}</td>
          <td class="num"><button class="btn btn-claro btn-peq" data-ed="${d.id}">Editar</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="vazio">Nenhuma despesa neste mês.</div>'}
      </div>
      <div class="card">
        <div class="card-topo"><h3>Por categoria</h3></div>
        ${porCat.length ? `<div class="barras">${porCat.map((x) => `<div class="barra-linha"><span>${esc(x.c)}</span><div class="barra-trilho"><div class="barra-cheia" style="width:${(x.v / maxCat) * 100}%"></div></div><b class="num" style="text-align:right">${fmt(x.v)}</b></div>`).join('')}</div>` : '<div class="vazio">Sem dados.</div>'}
      </div>
    </div>`;
  ligarSeletor(el, 'mesDesp');
  $('#nova-desp').onclick = () => abrirFormDespesa();
  $$('[data-ed]', el).forEach((b) => (b.onclick = () => abrirFormDespesa(state.despesas.find((x) => x.id === b.dataset.ed))));
}

function abrirFormDespesa(d = {}) {
  const novo = !d.id;
  const dataPadrao = mesChave(state.mesDesp) === mesChave(new Date()) ? hoje() : `${mesChave(state.mesDesp)}-01`;
  abrirModal(novo ? 'Nova despesa' : 'Editar despesa', `
    <form id="form-desp" class="grade-form">
      <label class="campo">Data<input type="date" name="data" required value="${esc(d.data || dataPadrao)}"></label>
      <label class="campo">Valor (R$)<input type="number" step="0.01" min="0.01" name="valor" required value="${d.valor ?? ''}"></label>
      <label class="campo inteiro">Categoria<select name="categoria">${CATEGORIAS.map((c) => `<option ${d.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="campo inteiro">Descrição<input name="descricao" placeholder="Ex.: cloro, conta de luz…" value="${esc(d.descricao)}"></label>
      <div class="modal-acoes inteiro">
        ${novo ? '' : '<button type="button" class="btn btn-perigo" id="desp-del">Excluir</button>'}
        <button type="button" class="btn btn-claro" data-fechar2>Cancelar</button>
        <button class="btn btn-ouro">Salvar</button>
      </div>
    </form>`, (m) => {
    $('[data-fechar2]', m).onclick = fecharModal;
    $('#desp-del', m) && ($('#desp-del', m).onclick = async () => {
      if (!confirm('Excluir esta despesa?')) return;
      await db.remove('despesas', d.id);
      state.despesas = state.despesas.filter((x) => x.id !== d.id);
      fecharModal(); toast('Despesa excluída.'); rerender();
    });
    $('#form-desp', m).onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const dados = { data: f.data, valor: +f.valor, categoria: f.categoria, descricao: f.descricao.trim() };
      if (novo) { const id = await db.add('despesas', dados); state.despesas.push({ id, ...dados }); }
      else { await db.update('despesas', d.id, dados); Object.assign(state.despesas.find((x) => x.id === d.id), dados); }
      state.mesDesp = new Date(`${dados.data}T12:00:00`);
      fecharModal(); toast('Despesa salva!'); rerender();
    };
  });
}

// ---------------------------------------------------------------- CLIENTES
async function renderClientes(el) {
  el.innerHTML = '<div class="card"><div class="vazio">Carregando clientes…</div></div>';
  let clientes = [];
  try { clientes = (await db.list('clientes')).sort((a, b) => String(a.nome).localeCompare(String(b.nome))); }
  catch (err) { console.error(err); el.innerHTML = '<div class="card"><div class="vazio">Não foi possível carregar os clientes. Confira se as regras do Firestore estão atualizadas.</div></div>'; return; }
  let busca = '';
  const desenhar = () => {
    const q = busca.toLowerCase();
    const lista = clientes.filter((c) => !q || [c.nome, c.email, c.telefone, c.cpf].some((v) => String(v || '').toLowerCase().includes(q)));
    $('#lista-cli').innerHTML = lista.length ? lista.map((c) => {
      const res = state.reservas.filter((r) => r.clienteUid === c.id);
      return `<div class="item-res" style="cursor:default;flex-wrap:wrap">
        <div class="ico">${ICO.pessoas}</div>
        <div class="meio"><b>${esc(c.nome)}</b>
          <small>${esc(c.email || '')} · ${foneFmt(c.telefone)}${c.cpf ? ` · CPF ${cpfFmt(c.cpf)}` : ''}</small>
          <small style="display:block">${esc(c.endereco || '')}</small>
          <small style="display:block">${res.length} reserva(s) · cadastro em ${c.criadoEm ? br(String(c.criadoEm).slice(0, 10)) : '—'}</small></div>
        <div class="dir"><div class="acoes">
          ${c.telefone ? `<a class="btn btn-verde btn-peq" target="_blank" rel="noopener" title="WhatsApp" href="https://wa.me/${foneBR(c.telefone)}">${ICO.zap}</a>` : ''}
          <button class="btn btn-perigo btn-peq" data-excluir="${c.id}">Excluir conta</button></div></div>
      </div>`;
    }).join('') : '<div class="vazio">Nenhum cliente encontrado.</div>';
    $$('[data-excluir]', el).forEach((b) => (b.onclick = () => excluirCliente(clientes.find((c) => c.id === b.dataset.excluir), () => { clientes = clientes.filter((c) => c.id !== b.dataset.excluir); desenhar(); })));
  };
  el.innerHTML = `<div class="card">
    <div class="card-topo"><div><h3>Clientes cadastrados</h3><small style="color:var(--cinza)">${clientes.length} conta(s)</small></div></div>
    <div class="filtros"><input id="busca-cli" placeholder="Buscar por nome, e-mail, telefone ou CPF…"></div>
    <div class="lista-res" id="lista-cli"></div></div>`;
  $('#busca-cli').oninput = (e) => { busca = e.target.value; desenhar(); };
  desenhar();
}

function excluirCliente(c, depois) {
  abrirModal('Excluir conta do cliente', `
    <p style="margin-bottom:12px">Excluir a conta de <b>${esc(c.nome)}</b> (${esc(c.email || '')})?</p>
    <div class="box-valores" style="font-size:14px;line-height:1.5">
      • O acesso dele ao site é <b>bloqueado na hora</b>.<br>
      • O cadastro (nome, CPF, endereço) é apagado e as pré-reservas pendentes dele são canceladas.<br>
      • O login (e-mail e senha) é apagado de vez na próxima execução do robô (todo dia às 9h, ou rodando o robô no GitHub → Actions).<br>
      • As reservas já confirmadas continuam no seu histórico.
    </div>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-top:12px"><input type="checkbox" id="bloq-email"> Impedir que este e-mail crie uma conta nova</label>
    <div class="modal-acoes"><button class="btn btn-claro" data-fechar2>Cancelar</button><button class="btn btn-perigo" id="conf-excluir">Excluir conta</button></div>`, (m) => {
    $('[data-fechar2]', m).onclick = fecharModal;
    $('#conf-excluir', m).onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'Excluindo…';
      try {
        await db.set('bloqueados', c.id, { email: c.email || '', nome: c.nome || '', excluirLogin: true, em: new Date().toISOString() });
        if ($('#bloq-email', m).checked && c.email) await db.set('bloqueiosEmail', c.email.toLowerCase(), { em: new Date().toISOString() });
        await db.remove('clientes', c.id);
        const pend = state.solicitacoes.filter((x) => x.uid === c.id);
        for (const x of pend) await db.update('solicitacoes', x.id, { status: 'recusada' });
        state.solicitacoes = state.solicitacoes.filter((x) => x.uid !== c.id);
        await sincronizarOcupacao(...pend.flatMap((x) => datasDe(x)));
        fecharModal(); toast('Conta excluída.'); depois && depois();
      } catch (err) {
        console.error(err); e.target.disabled = false; e.target.textContent = 'Tentar de novo';
        toast('Não foi possível excluir. Confira se as regras do Firestore estão atualizadas.');
      }
    };
  });
}

// ---------------------------------------------------------------- FOTOS
const MAX_FOTOS = 20;
async function renderFotos(el) {
  el.innerHTML = '<div class="card"><div class="vazio">Carregando fotos…</div></div>';
  let fotos = (await db.list('fotos')).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const desenhar = () => {
    el.innerHTML = `
      <div class="card">
        <div class="card-topo"><div><h3>Fotos que aparecem no calendário público</h3><small style="color:var(--cinza)">${fotos.length} de ${MAX_FOTOS} fotos · a primeira é a capa da galeria</small></div>
          <a class="btn btn-claro btn-peq" href="./" target="_blank" rel="noopener">Ver como o cliente vê ${ICO.dir}</a></div>
        <label class="upload-zona">${ICO.foto.replace('<svg', '<svg width="30" height="30" style="display:block;margin:0 auto 6px;color:var(--ouro)"')}
          <b>Toque para adicionar fotos</b><br>Pode escolher várias de uma vez · elas são otimizadas automaticamente
          <input type="file" id="up-fotos" accept="image/*" multiple hidden></label>
        <div class="erro" id="fotos-msg"></div>
        ${fotos.length ? `<div class="fotos-admin">${fotos.map((f, i) => `
          <div class="foto-adm">
            <img src="${f.thumb}" data-ver="${i}" alt="">
            <input placeholder="Legenda (ex.: Piscina)" maxlength="60" value="${esc(f.legenda)}" data-leg="${f.id}">
            <div class="acoes-foto">
              <button title="Mover para a esquerda" data-mov="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>◀</button>
              <button title="Excluir" class="del" data-del="${f.id}">🗑</button>
              <button title="Mover para a direita" data-mov="${i}" data-dir="1" ${i === fotos.length - 1 ? 'disabled' : ''}>▶</button>
            </div>
          </div>`).join('')}</div>` : '<div class="vazio">Nenhuma foto ainda. Adicione fotos da piscina, área gourmet, quartos, fachada…</div>'}
      </div>`;
    $('#up-fotos', el).onchange = async (e) => {
      const arqs = [...e.target.files].slice(0, MAX_FOTOS - fotos.length);
      if (!arqs.length) return toast(`Limite de ${MAX_FOTOS} fotos atingido.`);
      const msg = $('#fotos-msg', el);
      for (const [n, arq] of arqs.entries()) {
        msg.innerHTML = `<span style="color:var(--ouro-esc)">Enviando foto ${n + 1} de ${arqs.length}…</span>`;
        try {
          const thumb = await comprimir(arq, 420, 0.7, 60000);
          const full = await comprimir(arq, db.modoDemo ? 900 : 1600, db.modoDemo ? 0.6 : 0.8, db.modoDemo ? 150000 : 700000);
          const dados = { thumb, legenda: '', ordem: (fotos.at(-1)?.ordem ?? 0) + 1, criadoEm: new Date().toISOString() };
          const id = await db.add('fotos', dados);
          await db.set('fotosFull', id, { img: full });
          fotos.push({ id, ...dados });
        } catch (err) {
          console.error(err);
          msg.textContent = /quota/i.test(err.message || err.name) ? 'Sem espaço no modo demonstração. Ligue o Firebase para enviar mais fotos.' : `Não foi possível enviar "${arq.name}".`;
          return desenhar();
        }
      }
      toast('Fotos adicionadas!'); desenhar();
    };
    $$('[data-leg]', el).forEach((inp) => (inp.onchange = async () => {
      await db.update('fotos', inp.dataset.leg, { legenda: inp.value.trim() });
      fotos.find((f) => f.id === inp.dataset.leg).legenda = inp.value.trim(); toast('Legenda salva.');
    }));
    $$('[data-del]', el).forEach((b) => (b.onclick = async () => {
      if (!confirm('Excluir esta foto?')) return;
      await db.remove('fotos', b.dataset.del); await db.remove('fotosFull', b.dataset.del).catch(() => {});
      fotos = fotos.filter((f) => f.id !== b.dataset.del); desenhar();
    }));
    $$('[data-mov]', el).forEach((b) => (b.onclick = async () => {
      const i = +b.dataset.mov, j = i + +b.dataset.dir;
      [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
      fotos.forEach((f, k) => (f.ordem = k));
      await Promise.all([db.update('fotos', fotos[i].id, { ordem: i }), db.update('fotos', fotos[j].id, { ordem: j })]);
      desenhar();
    }));
    $$('[data-ver]', el).forEach((img) => (img.onclick = () => abrirVisualizador(fotos, +img.dataset.ver, async (id) => (await db.get('fotosFull', id))?.img)));
  };
  desenhar();
}

// ---------------------------------------------------------------- CHECKLIST DO SISTEMA
async function verificarSistema() {
  const c = state.config;
  const [pub, fotos] = await Promise.all([db.get('publico', 'info').catch(() => null), db.list('fotos').catch(() => [])]);
  const horariosOk = String(c.horarios || '').split(/[,;\s]+/).filter(Boolean).every((h) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(h));
  const publicado = pub && +pub.preco24 === +c.preco24 && +pub.preco12 === +c.preco12 && +pub.taxaLimpeza === +c.taxaLimpeza && (pub.pix?.chave || '') === (c.pixChave || '') && +(pub.intervaloH || 0) === +(c.intervaloH || 0);
  const https = db.modoDemo || location.protocol === 'https:';
  return [
    { ok: soDigitos(c.whatsapp).length === 11, t: 'WhatsApp para reservas', d: 'Número que recebe os clientes do site', ir: 'config' },
    { ok: !!(c.pixChave && c.pixNome && c.pixCidade), t: 'Pix configurado', d: 'Chave, nome do recebedor e cidade (teste o QR Code)', ir: 'config' },
    { ok: +c.preco12 > 0 && +c.preco24 > 0, t: 'Preços de 12h e 24h', d: `12h ${fmt(c.preco12)} · 24h ${fmt(c.preco24)} · limpeza ${fmt(c.taxaLimpeza)}`, ir: 'config' },
    { ok: horariosOk, t: 'Horários de entrada', d: c.horarios || '—', ir: 'config' },
    { ok: !!String(c.regras || '').trim(), t: 'Regras do espaço', d: 'Texto que o cliente aceita na pré-reserva', ir: 'config' },
    { ok: !!(c.locadorNome && cpfValido(c.locadorCpf) && c.locadorEndereco), t: 'Dados do contrato', d: 'Seu nome completo, CPF e endereço', ir: 'config' },
    { ok: !!c.assinatura, t: 'Assinatura no contrato', d: 'Foto da sua assinatura', ir: 'config' },
    { ok: fotos.length >= 3, t: 'Fotos da casa', d: `${fotos.length} foto(s) — recomendado pelo menos 3`, ir: 'fotos' },
    { ok: !!publicado, t: 'Informações publicadas para os clientes', d: publicado ? 'Preços, Pix e regras atualizados no site' : 'Clique em Salvar configurações para atualizar o site', ir: 'config' },
    { ok: !!db.dominioOficial, t: 'Proteção contra site falso', d: db.dominioOficial || 'Defina o dominioOficial no firebase-config.js' },
    { ok: https, t: 'Conexão segura (cadeado HTTPS)', d: https ? 'Site aberto com HTTPS' : 'Marque "Enforce HTTPS" no GitHub Pages' },
    { ok: true, t: 'E-mail do administrador confirmado', d: 'Acesso ao painel protegido' }
  ];
}

function htmlChecklist(itens) {
  const ok = itens.filter((i) => i.ok).length;
  return `<div class="card checklist">
    <div class="card-topo"><div><h3>✅ Checklist do sistema</h3><small style="color:var(--cinza)">${ok} de ${itens.length} itens prontos</small></div>
      <div class="barra-trilho" style="width:160px"><div class="barra-cheia" style="width:${(ok / itens.length) * 100}%"></div></div></div>
    ${itens.map((i) => `<div class="chk-item ${i.ok ? 'ok' : 'pend'}"><span>${i.ok ? '✔' : '!'}</span>
      <div><b>${esc(i.t)}</b><small>${esc(i.d)}</small></div>
      ${!i.ok && i.ir ? `<a href="#${i.ir}" class="btn btn-claro btn-peq">Resolver</a>` : ''}</div>`).join('')}
    <p style="font-size:12.5px;color:var(--cinza);margin-top:12px">Lembrete no WhatsApp: teste em GitHub → Actions → "Lembrete de locação" → Run workflow.</p>
  </div>`;
}

// ---------------------------------------------------------------- CONFIG
function renderConfig(el) {
  const c = state.config;
  setTimeout(async () => { const box = $('#chk-box'); if (box) box.innerHTML = htmlChecklist(await verificarSistema()); }, 0);
  const linkPublico = new URL('./', location.href).href.split('#')[0];
  const tipos = { celular: 'Celular', cpf: 'CPF / CNPJ', email: 'E-mail', aleatoria: 'Chave aleatória' };
  el.innerHTML = `<div id="chk-box" style="margin-bottom:18px"></div>
    <form id="form-cfg">
    <div class="duas-col">
      <div style="display:grid;gap:18px;align-content:start">
        <div class="card">
          <div class="card-topo"><h3>Preços e dados do espaço</h3></div>
          <div class="grade-form">
            <label class="campo inteiro">Nome do espaço<input name="nome" value="${esc(c.nome)}"></label>
            <label class="campo">Preço 12 horas (R$)<input type="number" step="0.01" name="preco12" value="${c.preco12}"></label>
            <label class="campo">Preço 24 horas (R$)<input type="number" step="0.01" name="preco24" value="${c.preco24}"></label>
            <label class="campo">Taxa de limpeza (R$)<input type="number" step="0.01" name="taxaLimpeza" value="${c.taxaLimpeza}"></label>
            <label class="campo">Horário padrão de entrada<input type="time" name="horaEntrada" value="${esc(c.horaEntrada)}"></label>
            <label class="campo inteiro">Horários de entrada que o cliente pode escolher<input name="horarios" value="${esc(c.horarios)}" placeholder="08:00">
              <small style="font-weight:400">Coloque <b>um só horário</b> (ex.: 08:00) para o horário ser fixo — o cliente não escolhe. Ou vários separados por vírgula. A saída é calculada sozinha: 12h → 12 horas depois; 24h → mesmo horário no dia seguinte; várias diárias → mesmo horário no dia seguinte à última diária.</small></label>
            <label class="campo inteiro">Intervalo entre locações (horas)<input type="number" name="intervaloH" min="0" max="24" step="1" value="${+c.intervaloH || 0}">
              <small style="font-weight:400">Tempo livre para a limpeza entre a saída de um cliente e a entrada do próximo. O site só oferece horários de entrada que respeitam esse intervalo (0 = sem intervalo).</small></label>
            <label class="campo inteiro">WhatsApp para reservas (com DDD)<input name="whatsapp" inputmode="tel" placeholder="(27) 99999-9999" value="${esc(c.whatsapp ? foneFmt(c.whatsapp) : '')}">
              <small style="font-weight:400">Os clientes do calendário público falam com você por este número.</small></label>
          </div>
        </div>
        <div class="card">
          <div class="card-topo"><h3>Pré-reserva pelo site</h3></div>
          <div class="grade-form">
            <label class="inteiro" style="display:flex;gap:10px;align-items:center;font-weight:600"><input type="checkbox" name="preReserva" ${c.preReserva ? 'checked' : ''} style="width:18px;height:18px"> Permitir que o cliente faça a pré-reserva pelo calendário</label>
            <label class="campo inteiro">Sinal para garantir a data
              <select name="sinalPct">${[30, 50, 100].map((n) => `<option value="${n}" ${+c.sinalPct === n ? 'selected' : ''}>${n === 100 ? 'Valor total (100%)' : n + '% do total'}</option>`).join('')}</select></label>
            <label class="campo inteiro">Tempo para o cliente pagar (minutos)<input type="number" name="prazoPagamentoMin" min="5" max="1440" value="${+c.prazoPagamentoMin || 30}">
              <small style="font-weight:400">Se o cliente não pagar e tocar em "Já paguei" nesse tempo, a pré-reserva expira e a data é liberada.</small></label>
            <label class="campo inteiro">Regras do espaço (o cliente precisa aceitar)<textarea name="regras" rows="5">${esc(c.regras)}</textarea></label>
          </div>
        </div>
      </div>
      <div style="display:grid;gap:18px;align-content:start">
        <div class="card">
          <div class="card-topo"><h3>Pix (QR Code)</h3></div>
          <p style="color:var(--cinza);font-size:14px;margin-bottom:12px">Na pré-reserva, o cliente recebe um QR Code Pix com o valor do sinal já preenchido.</p>
          <div class="grade-form">
            <label class="campo">Tipo da chave<select name="pixTipo">${Object.entries(tipos).map(([k, t]) => `<option value="${k}" ${c.pixTipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="campo">Chave Pix<input name="pixChave" value="${esc(c.pixChave)}" placeholder="Sua chave"></label>
            <label class="campo">Nome do recebedor<input name="pixNome" maxlength="25" value="${esc(c.pixNome)}" placeholder="Como aparece no banco"></label>
            <label class="campo">Cidade<input name="pixCidade" maxlength="15" value="${esc(c.pixCidade)}" placeholder="Ex.: Serra"></label>
          </div>
          <div style="margin-top:12px"><button type="button" class="btn btn-claro btn-peq" id="testar-pix">Testar QR Code (R$ 1,00)</button></div>
        </div>
        <div class="card">
          <div class="card-topo"><h3>🔐 Segurança do acesso</h3></div>
          <p style="color:var(--cinza);font-size:14px;line-height:1.5">O painel exige <b>duas etapas</b>: cada aparelho novo precisa ser autorizado pelo <b>link enviado ao seu e-mail</b> e depois a <b>senha do painel</b>. O botão <b>Sair</b> só tranca o painel neste aparelho (para voltar, basta a senha).</p>
          <div class="grade-form" style="margin-top:12px">
            <label class="campo">Nova senha do painel<input type="password" id="nova-senha" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label>
            <label class="campo">Repita a nova senha<input type="password" id="nova-senha2" minlength="8" autocomplete="new-password"></label>
          </div>
          <div class="modal-acoes" style="justify-content:flex-start">
            <button type="button" class="btn btn-claro btn-peq" id="trocar-senha">Trocar senha do painel</button>
            <button type="button" class="btn btn-perigo btn-peq" id="desconectar-aparelho">Desconectar este aparelho</button>
          </div>
        </div>
        <div class="card">
          <div class="card-topo"><h3>📄 Contrato</h3><button type="button" class="btn btn-claro btn-peq" id="ver-modelo">Ver modelo</button></div>
          <p style="color:var(--cinza);font-size:14px;margin-bottom:12px">Esses dados ficam só no seu painel (não vão para o GitHub). O cliente vê o contrato completo apenas depois que o pagamento for confirmado.</p>
          <div class="grade-form">
            <label class="campo inteiro">Seu nome completo (locador)<input name="locadorNome" value="${esc(c.locadorNome)}"></label>
            <label class="campo">Seu CPF<input name="locadorCpf" inputmode="numeric" placeholder="000.000.000-00" value="${esc(cpfFmt(c.locadorCpf))}"></label>
            <label class="campo">Foro (cidade/UF)<input name="foro" value="${esc(c.foro)}" placeholder="Serra/ES"></label>
            <label class="campo inteiro">Seu endereço<input name="locadorEndereco" value="${esc(c.locadorEndereco)}" placeholder="Rua, nº, bairro, cidade/UF"></label>
            <label class="campo inteiro">Endereço do imóvel (se for diferente)<input name="imovelEndereco" value="${esc(c.imovelEndereco)}" placeholder="Deixe vazio se for o mesmo"></label>
            <div class="campo inteiro">Sua assinatura
              <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
                <div id="assin-prev" style="background:#fff;border:1px dashed var(--linha);border-radius:10px;min-width:180px;height:70px;display:flex;align-items:center;justify-content:center;font-weight:400;color:var(--cinza);font-size:12px">${c.assinatura ? `<img src="${c.assinatura}" style="max-height:62px;max-width:220px">` : 'sem assinatura'}</div>
                <label class="btn btn-claro btn-peq" style="cursor:pointer">Enviar foto da assinatura<input type="file" id="up-assin" accept="image/*" hidden></label>
                ${c.assinatura ? '<button type="button" class="btn-link" id="rm-assin">remover</button>' : ''}
              </div>
              <small style="font-weight:400">Assine em papel branco com caneta escura e tire uma foto de perto.</small></div>
            <label class="campo inteiro">Cláusulas do contrato<textarea name="clausulas" rows="10" style="font-size:13px">${esc(c.clausulas)}</textarea>
              <small style="font-weight:400">As partes, o período e os valores são preenchidos automaticamente. Aqui ficam as regras (cuidados, piscina, utensílios, desistência…).</small></label>
          </div>
        </div>
        <div class="card">
          <div class="card-topo"><h3>Calendário público</h3></div>
          <p style="color:var(--cinza);font-size:14px;margin-bottom:12px">Envie este link para os clientes ou coloque na bio do Instagram. Eles veem só os dias livres e ocupados, sem nomes nem valores de outras reservas.</p>
          ${db.dominioOficial ? `<p class="nota-seg" style="margin-bottom:10px">🔒 Endereço oficial protegido: <b>${esc(db.dominioOficial)}</b>. Cópias do site em outros endereços mostram um alerta de site falso.</p>` : `<p class="aviso-demo" style="margin-bottom:10px">Defina o <b>dominioOficial</b> em <code>js/firebase-config.js</code> para ativar o alerta contra sites falsos.</p>`}
          <div class="link-box"><code>${esc(linkPublico)}</code><button type="button" class="btn btn-claro btn-peq" id="copiar">Copiar</button></div>
          <div style="margin-top:12px"><a class="btn btn-claro btn-peq" href="${esc(linkPublico)}" target="_blank" rel="noopener">Abrir calendário ${ICO.dir}</a></div>
        </div>
        <div class="card">
          <div class="card-topo"><h3>Backup</h3></div>
          <button type="button" class="btn btn-claro" id="backup">Baixar backup (.json)</button>
        </div>
      </div>
    </div>
    <div class="modal-acoes" style="position:sticky;bottom:12px"><button class="btn btn-ouro" style="padding:14px 28px">Salvar configurações</button></div>
    </form>`;
  $('#trocar-senha').onclick = async () => {
    const a = $('#nova-senha').value, b2 = $('#nova-senha2').value;
    if (a.length < 8) return toast('A senha precisa ter pelo menos 8 caracteres.');
    if (a !== b2) return toast('As senhas não conferem.');
    try { await db.trocarSenhaPainel(a); $('#nova-senha').value = $('#nova-senha2').value = ''; toast('Senha do painel alterada!'); }
    catch (err) { console.error(err); toast('Não foi possível trocar a senha: ' + (err.code || err.message)); }
  };
  $('#desconectar-aparelho').onclick = async () => {
    if (!confirm('Desconectar este aparelho? Para entrar de novo nele, será preciso autorizar pelo link do e-mail e digitar a senha.')) return;
    await db.trancarPainel(); await db.logout(); location.reload();
  };
  $('#copiar').onclick = async () => { try { await navigator.clipboard.writeText(linkPublico); toast('Link copiado!'); } catch { toast('Copie o link manualmente.'); } };
  $('#backup').onclick = () => {
    const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), config: state.config, reservas: state.reservas, despesas: state.despesas, solicitacoes: state.solicitacoes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vejareservas-backup-${hoje()}.json`; a.click();
  };
  const f = $('#form-cfg');
  let assinatura = c.assinatura || '';
  $('#up-assin').onchange = async (e) => {
    const arq = e.target.files[0]; if (!arq) return;
    assinatura = await comprimir(arq, 700, 0.85, 120000);
    $('#assin-prev').innerHTML = `<img src="${assinatura}" style="max-height:62px;max-width:220px">`;
    toast('Assinatura carregada. Clique em Salvar configurações.');
  };
  $('#rm-assin')?.addEventListener('click', () => { assinatura = ''; $('#assin-prev').textContent = 'sem assinatura'; });
  $('#ver-modelo').onclick = () => {
    const k = { nomeEspaco: f.nome.value, locadorNome: f.locadorNome.value, locadorCpf: soDigitos(f.locadorCpf.value), locadorEndereco: f.locadorEndereco.value, imovelEndereco: f.imovelEndereco.value, foro: f.foro.value, clausulas: f.clausulas.value, assinatura };
    const exemplo = { cliente: 'Nome do Cliente (exemplo)', clienteCpf: '', clienteEndereco: '', data: toISO(new Date(Date.now() + 15 * 864e5)), periodo: '24h', horaEntrada: f.horaEntrada.value || '09:00', valor: +f.preco24.value, taxaLimpeza: +f.taxaLimpeza.value, evento: 'Aniversário', pagamentos: [{ valor: Math.round(+f.preco24.value / 2), forma: 'Pix' }], aceiteContrato: new Date().toISOString(), clienteEmail: 'cliente@exemplo.com' };
    abrirContrato(htmlContrato(exemplo, k), 'Modelo de contrato');
  };
  $('#testar-pix').onclick = () => {
    if (!f.pixChave.value.trim() || !f.pixNome.value.trim()) return toast('Preencha a chave e o nome do recebedor.');
    const code = gerarPix({ chave: f.pixChave.value, tipo: f.pixTipo.value, nome: f.pixNome.value, cidade: f.pixCidade.value, valor: 1, txid: 'TESTE' });
    abrirModal('Teste do Pix', `<div style="text-align:center"><div class="pix-qr">${qrSVG(code, 220)}</div>
      <p style="color:var(--cinza);font-size:14px">Leia com o app do banco. Deve aparecer <b>R$ 1,00</b> para <b>${esc(f.pixNome.value)}</b>. Não precisa pagar, basta conferir os dados.</p>
      <div class="link-box" style="margin-top:12px"><code>${esc(code)}</code></div></div>`);
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const cfg = {
      nome: d.nome.trim() || 'Espaço Veja', preco12: +d.preco12, preco24: +d.preco24, taxaLimpeza: +d.taxaLimpeza,
      horaEntrada: d.horaEntrada, horarios: d.horarios.trim(), whatsapp: soDigitos(d.whatsapp),
      preReserva: !!d.preReserva, sinalPct: +d.sinalPct, prazoPagamentoMin: Math.min(1440, Math.max(5, +d.prazoPagamentoMin || 30)), regras: d.regras.trim(),
      intervaloH: Math.min(24, Math.max(0, Math.round(+d.intervaloH || 0))),
      pixTipo: d.pixTipo, pixChave: d.pixChave.trim(), pixNome: d.pixNome.trim(), pixCidade: d.pixCidade.trim(),
      locadorNome: d.locadorNome.trim(), locadorCpf: soDigitos(d.locadorCpf), locadorEndereco: d.locadorEndereco.trim(),
      imovelEndereco: d.imovelEndereco.trim(), foro: d.foro.trim(), clausulas: d.clausulas.trim() || CLAUSULAS_PADRAO, assinatura
    };
    if (cfg.locadorCpf && !cpfValido(cfg.locadorCpf)) return toast('Seu CPF parece inválido. Confira os números.');
    const hs = cfg.horarios.split(/[,;\s]+/).filter(Boolean);
    if (!hs.length || hs.some((h) => !/^([01]?\d|2[0-3]):[0-5]\d$/.test(h))) return toast('Horários de entrada inválidos. Use o formato 08:00, 09:00, 14:30.');
    cfg.horarios = hs.map((h) => h.padStart(5, '0')).join(', ');
    if (hs.length === 1) cfg.horaEntrada = hs[0].padStart(5, '0'); // horário fixo
    if (cfg.whatsapp && cfg.whatsapp.length !== 11) return toast('WhatsApp deve ter DDD + 9 dígitos (11 números).');
    await db.set('config', 'geral', cfg);
    // dados que o calendário público pode ver
    await db.set('publico', 'info', {
      nome: cfg.nome, whatsapp: cfg.whatsapp ? foneBR(cfg.whatsapp) : '',
      preco12: cfg.preco12, preco24: cfg.preco24, taxaLimpeza: cfg.taxaLimpeza, horaEntrada: cfg.horaEntrada, horarios: cfg.horarios,
      preReserva: cfg.preReserva, sinalPct: cfg.sinalPct, prazoPagamentoMin: cfg.prazoPagamentoMin, regras: cfg.regras, intervaloH: cfg.intervaloH,
      pix: cfg.pixChave ? { chave: cfg.pixChave, tipo: cfg.pixTipo, nome: cfg.pixNome, cidade: cfg.pixCidade } : null,
      // prévia do contrato para o cliente (sem o seu CPF completo e sem o seu endereço)
      contrato: { nomeEspaco: cfg.nome, locadorNome: cfg.locadorNome, locadorCpfMasc: cfg.locadorCpf ? cpfMascarado(cfg.locadorCpf) : '', imovelEndereco: cfg.imovelEndereco || cfg.locadorEndereco || '', foro: cfg.foro, clausulas: cfg.clausulas }
    });
    state.config = cfg; $('#nome-espaco').textContent = cfg.nome;
    toast('Configurações salvas!');
    const box = $('#chk-box'); if (box) box.innerHTML = htmlChecklist(await verificarSistema());
  };
}

// ---------------------------------------------------------------- inicialização
async function iniciar() {
  montarMenus();
  if (db.modoDemo) { db.semearDemo(); $('#aviso-demo').classList.remove('oculto'); $('#faixa-demo').classList.remove('oculto'); }

  document.addEventListener('click', (e) => { if (e.target.closest('[data-acao="nova-reserva"]')) abrirFormReserva(); });
  window.addEventListener('hashchange', rota);
  $('#btn-sair').onclick = async () => { await db.trancarPainel(); location.reload(); };

  // ----- 1ª etapa: autorizar o aparelho pelo link no e-mail
  const mostrarForm = (id) => ['#form-link', '#link-enviado', '#form-confirmar-link', '#form-senha'].forEach((f) => $(f).classList.toggle('oculto', f !== id));
  $('#link-voltar').onclick = () => mostrarForm('#form-link');
  $('#ja-tenho-link').onclick = () => {
    const email = $('#link-email').value.trim() || db.emailDoLink();
    if (!email) return ($('#link-erro').textContent = 'Digite o seu e-mail primeiro.');
    localStorage.setItem('vejareservas_email_link', email);
    $('#link-para').textContent = email; mostrarForm('#link-enviado');
  };
  $('#link-colar-btn').onclick = async () => {
    try { $('#link-colar').value = await navigator.clipboard.readText(); }
    catch { $('#link-colar').focus(); $('#link-colar-erro').textContent = 'Toque e segure no campo acima e escolha "Colar".'; }
  };
  $('#link-colar-ok').onclick = async () => {
    const erro = $('#link-colar-erro'), btn = $('#link-colar-ok');
    erro.textContent = '';
    const link = db.linkColado($('#link-colar').value);
    if (!link) return (erro.textContent = 'Isso não parece o link de acesso. Copie o link do e-mail mais recente.');
    const email = $('#link-para').textContent.trim() || db.emailDoLink();
    btn.disabled = true; btn.textContent = 'Autorizando…';
    try { await db.concluirLinkAcesso(email, link); }
    catch (err) {
      console.error(err);
      erro.textContent = /invalid-action-code|expired/.test(err.code) ? 'Este link expirou ou já foi aberto. Toque em Voltar e peça um novo (não abra, só copie).' : /invalid-email/.test(err.code) ? 'O e-mail não confere com o do link.' : 'Não foi possível autorizar: ' + (err.code || err.message);
    }
    btn.disabled = false; btn.textContent = 'Autorizar este aparelho';
  };
  $('#form-link').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#link-email').value.trim(), btn = $('#form-link button[type=submit]');
    $('#link-erro').textContent = ''; btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      await db.enviarLinkAcesso(email);
      if (db.modoDemo) { await db.login(email, ''); return; }
      $('#link-para').textContent = email; mostrarForm('#link-enviado');
    } catch (err) {
      console.error(err);
      $('#link-erro').textContent = /operation-not-allowed/.test(err.code) ? 'O login por link ainda não foi ativado no Firebase.' : /quota-exceeded/.test(err.code) ? 'Limite de links de hoje atingido (o Firebase gratuito envia 5 por dia). Tente amanhã ou use um aparelho já autorizado.' : /too-many/.test(err.code) ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não foi possível enviar: ' + (err.code || err.message);
    }
    btn.disabled = false; btn.textContent = 'Continuar';
  };
  const concluir = async (email, erroEl) => {
    try { await db.concluirLinkAcesso(email); }
    catch (err) { console.error(err); erroEl.textContent = /invalid-action-code|expired/.test(err.code) ? 'Este link expirou ou já foi usado. Peça um novo.' : /invalid-email/.test(err.code) ? 'O e-mail não confere com o do link.' : 'Não foi possível autorizar: ' + (err.code || err.message); mostrarForm(erroEl.id === 'conf-link-erro' ? '#form-confirmar-link' : '#form-link'); $('#tela-login').classList.remove('oculto'); }
  };
  if (await db.ehLinkDeAcesso()) {
    const email = db.emailDoLink();
    $('#form-confirmar-link').onsubmit = (e) => { e.preventDefault(); concluir($('#conf-link-email').value.trim(), $('#conf-link-erro')); };
    if (email) await concluir(email, $('#link-erro'));
    else { mostrarForm('#form-confirmar-link'); $('#tela-login').classList.remove('oculto'); }
  }

  // ----- 2ª etapa: senha do painel
  let criando = false;
  $('#primeiro-acesso').onclick = () => {
    criando = !criando;
    $('#campo-senha2').classList.toggle('oculto', !criando);
    $('#senha-btn').textContent = criando ? 'Criar senha e entrar' : 'Entrar';
    $('#primeiro-acesso').textContent = criando ? 'Já tenho a senha do painel' : 'Primeiro acesso? Criar a senha do painel';
    $('#senha-painel').autocomplete = criando ? 'new-password' : 'current-password';
  };
  $('#desconectar').onclick = () => db.logout();
  $('#form-senha').onsubmit = async (e) => {
    e.preventDefault();
    const senha = $('#senha-painel').value, erro = $('#senha-erro'), btn = $('#senha-btn');
    erro.textContent = '';
    if (criando) {
      if (senha.length < 8) return (erro.textContent = 'Use pelo menos 8 caracteres.');
      if (senha !== $('#senha-painel2').value) return (erro.textContent = 'As senhas não conferem.');
    }
    btn.disabled = true; btn.textContent = 'Verificando…';
    try {
      if (criando) await db.criarSenhaPainel(senha); else await db.desbloquearPainel(senha);
      location.reload();
    } catch (err) {
      console.error(err);
      btn.disabled = false; btn.textContent = criando ? 'Criar senha e entrar' : 'Entrar';
      erro.textContent = /requires-recent-login/.test(err.code) ? 'Por segurança, desconecte e autorize o aparelho de novo pelo link.'
        : criando ? 'Não foi possível criar: a senha do painel já existe. Use "Já tenho a senha".' : 'Senha incorreta.';
    }
  };

  await db.onAuth(async (user) => {
    if (!user) { $('#tela-app').classList.add('oculto'); $('#tela-login').classList.remove('oculto'); return; }
    $('#tela-login').classList.add('oculto');
    $('#usuario-email').textContent = user.email;
    state.usuarioEmail = user.email;
    // aparelho não autorizado pelo link do e-mail (ex.: entrou só com senha antiga): pede autorização
    if (!user.emailVerified) { await db.logout(); return; }
    try { await carregar(); }
    catch (err) {
      console.error(err);
      const negado = /permission|insufficient/i.test(err.code || err.message);
      // aparelho autorizado, mas painel trancado: pede a senha do painel
      if (negado && !db.modoDemo) {
        $('#tela-app').classList.add('oculto'); $('#tela-login').classList.remove('oculto');
        $('#senha-email').textContent = user.email; mostrarForm('#form-senha'); $('#senha-painel').focus();
        return;
      }
      $('#tela-app').classList.remove('oculto');
      $('#conteudo').innerHTML = negado
        ? `<div class="card"><h3>🔒 Acesso restrito</h3><p style="margin-top:8px;color:var(--cinza)">A conta <b>${esc(user.email)}</b> não tem permissão para acessar o painel do proprietário.<br><br>Se você é cliente, use o <a href="./">site de reservas</a>. Se você é o dono, confira se este e-mail está nas regras do Firestore (veja o README).</p><button class="btn btn-claro" style="margin-top:14px" id="sair-restrito">Sair desta conta</button></div>`
        : `<div class="card"><h3>Não foi possível carregar os dados</h3><p style="margin-top:8px;color:var(--cinza)">${esc(err.message)}</p><button class="btn btn-claro" style="margin-top:14px" id="sair-restrito">Sair</button></div>`;
      $('#sair-restrito').onclick = () => db.logout();
      return;
    }
    $('#tela-app').classList.remove('oculto');
    rota();
  });
}

function mostrarVerificacaoDono(user) {
  $('#conteudo').innerHTML = `<div class="card" style="max-width:560px">
    <h3>🔐 Confirme o e-mail do administrador</h3>
    <p style="margin-top:10px;color:var(--cinza);line-height:1.5">Por segurança, o painel só abre depois que o e-mail <b>${esc(user.email)}</b> for confirmado. Isso é feito uma única vez.</p>
    <ol style="margin:14px 0 0 18px;color:var(--cinza);line-height:1.7"><li>Clique em <b>Enviar e-mail de confirmação</b>.</li><li>Abra o e-mail (olhe também no spam) e clique no link.</li><li>Volte aqui e clique em <b>Já confirmei</b>.</li></ol>
    <div class="erro" id="ver-msg" style="margin-top:10px"></div>
    <div class="modal-acoes" style="justify-content:flex-start">
      <button class="btn btn-ouro" id="ver-enviar">Enviar e-mail de confirmação</button>
      <button class="btn btn-claro" id="ver-ok">Já confirmei</button>
      <button class="btn btn-claro" id="ver-sair">Sair</button>
    </div></div>`;
  $('#ver-sair').onclick = () => db.logout();
  $('#ver-enviar').onclick = async (e) => {
    try { await db.clienteReenviarConfirmacao(); e.target.textContent = 'E-mail enviado ✓'; e.target.disabled = true; $('#ver-msg').innerHTML = '<span style="color:var(--verde)">Enviado! Confira sua caixa de entrada e o spam.</span>'; }
    catch (err) { $('#ver-msg').textContent = /too-many/i.test(err.code) ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não foi possível enviar: ' + (err.code || err.message); }
  };
  $('#ver-ok').onclick = async () => {
    if (await db.clienteVerificarEmail()) { location.reload(); }
    else $('#ver-msg').textContent = 'Ainda não identificamos a confirmação. Clique no link do e-mail e tente de novo.';
  };
}

iniciar();
