// =====================================================================
//  VejaReservas — painel administrativo
// =====================================================================
import * as db from './db.js';
import { renderCalendario, MESES, toISO } from './calendar.js';
import { gerarPix, qrSVG } from './pix.js';
import { comprimir, abrirVisualizador } from './fotos.js';

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
const foneFmt = (s) => { const d = soDigitos(s).replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : s || '—'; };

function toast(msg) {
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
const REGRAS_PADRAO = '• A limpeza pós-evento é opcional. Sem ela, o espaço deve ser devolvido limpo e organizado.\n• Em caso de desistência, o valor pago não é reembolsado: a reserva fica congelada como crédito para uma nova data, com prioridade.\n• A data só é garantida após a confirmação do pagamento do sinal.';
const CONFIG_PADRAO = {
  nome: 'Espaço Veja', preco12: 770, preco24: 1000, taxaLimpeza: 75, horaEntrada: '09:00', horarios: '08:00, 09:00, 10:00, 12:00, 14:00', whatsapp: '',
  preReserva: true, sinalPct: 50, regras: REGRAS_PADRAO,
  pixTipo: 'celular', pixChave: '', pixNome: '', pixCidade: ''
};

const selo = (s) => `<span class="selo st-${s}">${STATUS[s]?.label || s}</span>`;

// ---------------------------------------------------------------- estado
const state = {
  reservas: [], despesas: [], solicitacoes: [], config: { ...CONFIG_PADRAO },
  mesInicio: new Date(), mesFin: new Date(), mesDesp: new Date(),
  filtroStatus: 'ativas', busca: ''
};

function calc(r) {
  const total = (+r.valor || 0) + (+r.taxaLimpeza || 0);
  const recebido = (r.pagamentos || []).reduce((s, p) => s + (+p.valor || 0), 0);
  return { total, recebido, falta: Math.max(0, total - recebido) };
}

async function carregar() {
  const [reservas, despesas, cfg, sols] = await Promise.all([db.list('reservas'), db.list('despesas'), db.get('config', 'geral'), db.list('solicitacoes')]);
  state.reservas = reservas;
  state.solicitacoes = sols.filter((x) => x.status !== 'recusada').sort((a, b) => String(a.data).localeCompare(String(b.data)));
  state.despesas = despesas;
  state.config = { ...CONFIG_PADRAO, ...(cfg || {}) };
  $('#nome-espaco').textContent = state.config.nome;
}

// Mantém a coleção pública "ocupacao" (só datas, sem dados de clientes)
async function sincronizarOcupacao(...datas) {
  for (const data of new Set(datas.filter(Boolean))) {
    const temSol = state.solicitacoes.some((x) => x.data === data);
    const ocupada = temSol || state.reservas.some((r) => r.data === data && OCUPA.includes(r.status));
    const pendente = ocupada && !state.reservas.some((r) => r.data === data && ['confirmada', 'concluida'].includes(r.status));
    if (ocupada) await db.set('ocupacao', data, { status: pendente ? 'pendente' : 'reservado' });
    else await db.remove('ocupacao', data).catch(() => {});
  }
}

// ---------------------------------------------------------------- navegação
const PAGINAS = {
  inicio: { titulo: 'Visão geral', menu: 'Início', ico: ICO.casa, render: renderInicio },
  reservas: { titulo: 'Reservas', menu: 'Reservas', ico: ICO.cal, render: renderReservas },
  financeiro: { titulo: 'Financeiro', menu: 'Financeiro', ico: ICO.din, render: renderFinanceiro },
  despesas: { titulo: 'Despesas', menu: 'Despesas', ico: ICO.lista, render: renderDespesas },
  fotos: { titulo: 'Fotos da casa', menu: 'Fotos', ico: ICO.foto, render: renderFotos },
  config: { titulo: 'Configurações', menu: 'Ajustes', ico: ICO.eng, render: renderConfig }
};

function montarMenus() {
  const links = Object.entries(PAGINAS).map(([k, p]) => `<a href="#${k}" data-pag="${k}">${p.ico}<span>${p.menu}</span></a>`).join('');
  $('#menu').innerHTML = links;
  $('#nav-mobile').innerHTML = links;
}

function atualizarBadge() {
  const n = state.solicitacoes.length;
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

  el.innerHTML = blocoSolicitacoes() + `
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
      marc[r.data] = r.status === 'pendente' && marc[r.data] !== 'reservado' ? 'pendente' : 'reservado';
    });
    state.solicitacoes.forEach((x) => { if (!marc[x.data]) marc[x.data] = 'pendente'; });
    $('#cal-titulo').textContent = nomeMes(state.mesInicio);
    renderCalendario($('#cal'), state.mesInicio, marc, (iso, estado) => {
      if (estado === 'livre') abrirFormReserva({ data: iso });
      else { const r = state.reservas.find((x) => x.data === iso && OCUPA.includes(x.status)); if (r) abrirDetalhe(r.id); else toast('Pré-reserva do site aguardando aprovação.'); }
    });
  };
  const mover = (n) => { state.mesInicio = new Date(state.mesInicio.getFullYear(), state.mesInicio.getMonth() + n, 1); desenhar(); };
  $('#cal-ant').onclick = () => mover(-1);
  $('#cal-prox').onclick = () => mover(1);
  $('#cal-hoje').onclick = () => { state.mesInicio = new Date(); desenhar(); };
  desenhar();
  ligarItens(el);
  ligarSolicitacoes(el);
}

function blocoSolicitacoes() {
  if (!state.solicitacoes.length) return '';
  return `<div class="card solic">
    <div class="card-topo"><div><h3>Pré-reservas feitas pelo site</h3><small style="color:var(--cinza)">Confira o pagamento e aprove para virar reserva.</small></div><span class="badge" style="margin:0;font-size:13px;padding:3px 10px">${state.solicitacoes.length}</span></div>
    <div class="lista-res">${state.solicitacoes.map((x) => `
      <div class="item-res">
        <div class="ico">${ICO.cal}</div>
        <div class="meio"><b>${esc(x.cliente)}</b><small>${br(x.data)} — ${esc(x.evento || 'Evento')} · ${x.periodo}${x.horaEntrada ? ' · entrada ' + x.horaEntrada : ''} · <b style="display:inline;font-size:13px;color:var(--ouro-esc)">${esc(x.codigo)}</b></small>
          <small style="display:block">${foneFmt(x.telefone)}${x.email ? ` · ${esc(x.email)}` : ''}${x.sinal ? ` · sinal via Pix: ${fmt(x.sinal)}` : ''}${x.obs ? ` · ${esc(x.obs)}` : ''}</small></div>
        <div class="dir"><b style="margin:0 0 8px">${fmt(x.total)}</b><div class="acoes">
          <a class="btn btn-verde btn-peq" target="_blank" rel="noopener" title="WhatsApp" href="https://wa.me/${foneBR(x.telefone)}?text=${encodeURIComponent(`Olá, ${x.cliente.split(' ')[0]}! Recebemos sua pré-reserva ${x.codigo} do ${state.config.nome} para ${br(x.data)}.`)}">${ICO.zap}</a>
          <button class="btn btn-perigo btn-peq" data-recusar="${x.id}">Recusar</button>
          <button class="btn btn-ouro btn-peq" data-aprovar="${x.id}">Aprovar</button></div></div>
      </div>`).join('')}</div></div>`;
}

function ligarSolicitacoes(el) {
  $$('[data-aprovar]', el).forEach((b) => (b.onclick = () => {
    const x = state.solicitacoes.find((s) => s.id === b.dataset.aprovar);
    abrirFormReserva({
      cliente: x.cliente, telefone: x.telefone, data: x.data, periodo: x.periodo, evento: x.evento, horaEntrada: x.horaEntrada || state.config.horaEntrada,
      valor: x.valor, taxaLimpeza: x.taxaLimpeza, status: x.sinal ? 'confirmada' : 'pendente',
      obs: [`Pré-reserva ${x.codigo} (site)`, x.obs].filter(Boolean).join(' — '),
      _sol: x.id, _sinal: x.sinal, _clienteUid: x.uid, _clienteEmail: x.email
    });
  }));
  $$('[data-recusar]', el).forEach((b) => (b.onclick = async () => {
    const x = state.solicitacoes.find((s) => s.id === b.dataset.recusar);
    if (!confirm(`Recusar a pré-reserva de ${x.cliente} (${br(x.data)})? A data volta a ficar livre no calendário.`)) return;
    await db.update('solicitacoes', x.id, { status: 'recusada' }); // o cliente vê "Não aprovada" na conta dele
    state.solicitacoes = state.solicitacoes.filter((s) => s.id !== x.id);
    await sincronizarOcupacao(x.data);
    toast('Pré-reserva recusada.'); rerender();
  }));
}

function itemReserva(r) {
  const c = calc(r);
  return `<div class="item-res" data-id="${r.id}">
    <div class="ico">${ICO.cal}</div>
    <div class="meio"><b>${esc(r.cliente)}</b><small>${br(r.data)} — ${esc(r.evento || 'Evento')} · ${r.periodo}</small></div>
    <div class="dir">${selo(r.status)}<b>${fmt(c.total)}</b>${c.falta > 0 && r.status !== 'cancelada' ? `<small style="color:var(--laranja);font-size:12px">falta ${fmt(c.falta)}</small>` : ''}</div>
  </div>`;
}
const ligarItens = (el) => $$('.item-res', el).forEach((i) => (i.onclick = () => abrirDetalhe(i.dataset.id)));

// ---------------------------------------------------------------- RESERVAS
function renderReservas(el) {
  const filtros = { ativas: 'Próximas', todas: 'Todas', pendente: 'Pendentes', confirmada: 'Confirmadas', congelada: 'Congeladas', concluida: 'Concluídas', cancelada: 'Canceladas' };
  el.innerHTML = blocoSolicitacoes() + `
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
  ligarSolicitacoes(el);
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
  const v = { periodo: '24h', horaEntrada: cfg.horaEntrada, status: 'pendente', taxaLimpeza: 0, ...r };
  if (v.valor == null) v.valor = v.periodo === '12h' ? cfg.preco12 : cfg.preco24;

  abrirModal(novo ? 'Nova reserva' : 'Editar reserva', `
    <form id="form-res" class="grade-form">
      <label class="campo inteiro">Nome do cliente<input name="cliente" required value="${esc(v.cliente)}"></label>
      <label class="campo">WhatsApp / telefone<input name="telefone" inputmode="tel" placeholder="(27) 99999-9999" value="${esc(foneFmt(v.telefone) === '—' ? '' : foneFmt(v.telefone))}"></label>
      <label class="campo">Tipo de evento<input name="evento" list="eventos" placeholder="Aniversário, churrasco…" value="${esc(v.evento)}">
        <datalist id="eventos"><option>Aniversário</option><option>Confraternização</option><option>Chá de bebê</option><option>Churrasco</option><option>Casamento</option><option>Day use</option></datalist></label>
      <label class="campo">Data${v.status === 'congelada' ? ' (opcional se congelada)' : ''}<input type="date" name="data" value="${esc(v.data)}"></label>
      <label class="campo">Período
        <select name="periodo"><option value="24h" ${v.periodo === '24h' ? 'selected' : ''}>24 horas</option><option value="12h" ${v.periodo === '12h' ? 'selected' : ''}>12 horas</option></select></label>
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
    f.periodo.onchange = () => { f.valor.value = f.periodo.value === '12h' ? cfg.preco12 : cfg.preco24; atualizarTotal(); };
    f.valor.oninput = f.taxaLimpeza.oninput = atualizarTotal;
    const atualizarSaida = () => {
      const el = $('#saida-prev', m);
      if (!f.data.value || !f.horaEntrada.value) return (el.textContent = '');
      const [h, mi] = f.horaEntrada.value.split(':').map(Number);
      const d = new Date(`${f.data.value}T00:00:00`); d.setHours(h + (f.periodo.value === '12h' ? 12 : 24), mi);
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
      const dados = {
        cliente: d.cliente.trim(), telefone: soDigitos(d.telefone), evento: d.evento.trim(), data: d.data || '',
        periodo: d.periodo, horaEntrada: d.horaEntrada, status: d.status, valor: +d.valor || 0,
        taxaLimpeza: d.querLimpeza ? +d.taxaLimpeza || 0 : 0, obs: d.obs.trim()
      };
      if (!dados.data && dados.status !== 'congelada') return ($('#res-erro', m).textContent = 'Informe a data (só reservas congeladas podem ficar sem data).');
      if (dados.data && OCUPA.includes(dados.status)) {
        const choque = state.reservas.find((x) => x.id !== r.id && x.data === dados.data && OCUPA.includes(x.status));
        if (choque && !confirm(`Atenção: ${br(dados.data)} já está reservado para ${choque.cliente}. Salvar mesmo assim?`)) return;
      }
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        if (novo) {
          dados.pagamentos = +d.sinal > 0 ? [{ valor: +d.sinal, data: hoje(), forma: d.formaSinal }] : [];
          dados.criadoEm = `${hoje()}T${new Date().toTimeString().slice(0, 8)}`;
          if (r._clienteUid) { dados.clienteUid = r._clienteUid; dados.clienteEmail = r._clienteEmail || ''; }
          const id = await db.add('reservas', dados);
          state.reservas.push({ id, ...dados });
          if (r._sol) {
            await db.remove('solicitacoes', r._sol);
            state.solicitacoes = state.solicitacoes.filter((s) => s.id !== r._sol);
          }
        } else {
          await db.update('reservas', r.id, dados);
          Object.assign(state.reservas.find((x) => x.id === r.id), dados);
        }
        await sincronizarOcupacao(dados.data, r.data);
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
  const saida = (() => {
    if (!r.data || !r.horaEntrada) return '';
    const [h, mi] = r.horaEntrada.split(':').map(Number);
    const dt = new Date(`${r.data}T00:00:00`); dt.setHours(h + (r.periodo === '12h' ? 12 : 24), mi);
    return `${br(toISO(dt))} às ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  })();
  const msgCliente = encodeURIComponent(`Olá, ${r.cliente.split(' ')[0]}! Aqui é do ${state.config.nome}. Sobre a sua reserva do dia ${br(r.data)} (${r.periodo}, entrada às ${r.horaEntrada})` + (c.falta > 0 ? `, fica um saldo de ${fmt(c.falta)} a acertar.` : '. Está tudo certo! 😊'));

  abrirModal(esc(r.cliente), `
    <div style="margin-bottom:14px">${selo(r.status)} <small style="color:var(--cinza);margin-left:6px">${STATUS[r.status]?.ajuda || ''}</small></div>
    <div class="det-grade">
      <div><small>Data</small><b>${br(r.data)}</b></div>
      <div><small>Período</small><b>${r.periodo} · entrada ${r.horaEntrada || '—'}</b></div>
      <div><small>Saída prevista</small><b>${saida || '—'}</b></div>
      <div><small>Evento</small><b>${esc(r.evento || '—')}</b></div>
      <div><small>Telefone</small><b>${foneFmt(r.telefone)}</b></div>
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
      <button class="btn btn-claro" id="d-editar">Editar</button>
      ${c.falta > 0 ? '<button class="btn btn-ouro" id="d-pagar">Registrar pagamento</button>' : ''}
    </div>`, (m) => {
    $('#d-editar', m).onclick = () => abrirFormReserva(r);
    $('#d-pagar', m) && ($('#d-pagar', m).onclick = () => abrirPagamento(r));
    $('#d-excluir', m).onclick = async () => {
      if (!confirm(`Excluir a reserva de ${r.cliente}? Isso não pode ser desfeito.`)) return;
      await db.remove('reservas', r.id);
      state.reservas = state.reservas.filter((x) => x.id !== r.id);
      await sincronizarOcupacao(r.data);
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
      await db.update('reservas', r.id, upd);
      Object.assign(r, upd);
      await sincronizarOcupacao(r.data);
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

// ---------------------------------------------------------------- CONFIG
function renderConfig(el) {
  const c = state.config;
  const linkPublico = new URL('./', location.href).href.split('#')[0];
  const tipos = { celular: 'Celular', cpf: 'CPF / CNPJ', email: 'E-mail', aleatoria: 'Chave aleatória' };
  el.innerHTML = `
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
            <label class="campo inteiro">Horários de entrada que o cliente pode escolher<input name="horarios" value="${esc(c.horarios)}" placeholder="08:00, 09:00, 10:00">
              <small style="font-weight:400">Separe por vírgula. A saída é calculada sozinha (12h ou 24h depois).</small></label>
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
  $('#copiar').onclick = async () => { try { await navigator.clipboard.writeText(linkPublico); toast('Link copiado!'); } catch { toast('Copie o link manualmente.'); } };
  $('#backup').onclick = () => {
    const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), config: state.config, reservas: state.reservas, despesas: state.despesas, solicitacoes: state.solicitacoes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vejareservas-backup-${hoje()}.json`; a.click();
  };
  const f = $('#form-cfg');
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
      preReserva: !!d.preReserva, sinalPct: +d.sinalPct, regras: d.regras.trim(),
      pixTipo: d.pixTipo, pixChave: d.pixChave.trim(), pixNome: d.pixNome.trim(), pixCidade: d.pixCidade.trim()
    };
    await db.set('config', 'geral', cfg);
    // dados que o calendário público pode ver
    await db.set('publico', 'info', {
      nome: cfg.nome, whatsapp: cfg.whatsapp ? foneBR(cfg.whatsapp) : '',
      preco12: cfg.preco12, preco24: cfg.preco24, taxaLimpeza: cfg.taxaLimpeza, horaEntrada: cfg.horaEntrada, horarios: cfg.horarios,
      preReserva: cfg.preReserva, sinalPct: cfg.sinalPct, regras: cfg.regras,
      pix: cfg.pixChave ? { chave: cfg.pixChave, tipo: cfg.pixTipo, nome: cfg.pixNome, cidade: cfg.pixCidade } : null
    });
    state.config = cfg; $('#nome-espaco').textContent = cfg.nome;
    toast('Configurações salvas!');
  };
}

// ---------------------------------------------------------------- inicialização
async function iniciar() {
  montarMenus();
  if (db.modoDemo) { db.semearDemo(); $('#aviso-demo').classList.remove('oculto'); $('#faixa-demo').classList.remove('oculto'); }

  document.addEventListener('click', (e) => { if (e.target.closest('[data-acao="nova-reserva"]')) abrirFormReserva(); });
  window.addEventListener('hashchange', rota);
  $('#btn-sair').onclick = () => db.logout();

  $('#esqueci-admin').onclick = async () => {
    const email = $('#login-email').value.trim();
    if (!email) return ($('#login-erro').textContent = 'Digite seu e-mail acima primeiro.');
    try { await db.recuperarSenha(email); $('#login-erro').innerHTML = '<span style="color:var(--verde)">Link de redefinição enviado para o seu e-mail.</span>'; }
    catch (err) { $('#login-erro').textContent = 'Não foi possível enviar: ' + (err.code || err.message); }
  };
  $('#form-login').onsubmit = async (e) => {
    e.preventDefault();
    $('#login-erro').textContent = '';
    try { await db.login($('#login-email').value.trim(), $('#login-senha').value); }
    catch (err) { $('#login-erro').textContent = /invalid|wrong|user-not-found|credential/i.test(err.code || err.message) ? 'E-mail ou senha incorretos.' : 'Erro ao entrar: ' + (err.code || err.message); }
  };

  await db.onAuth(async (user) => {
    if (!user) { $('#tela-app').classList.add('oculto'); $('#tela-login').classList.remove('oculto'); return; }
    $('#tela-login').classList.add('oculto');
    $('#usuario-email').textContent = user.email;
    try { await carregar(); }
    catch (err) {
      console.error(err);
      $('#tela-app').classList.remove('oculto');
      const negado = /permission|insufficient/i.test(err.code || err.message);
      $('#conteudo').innerHTML = negado
        ? `<div class="card"><h3>🔒 Acesso restrito</h3><p style="margin-top:8px;color:var(--cinza)">A conta <b>${esc(user.email)}</b> não tem permissão para acessar o painel do proprietário.<br><br>Se você é cliente, use o <a href="./">site de reservas</a>. Se você é o dono, confira se este e-mail está nas regras do Firestore (veja o README).</p><button class="btn btn-claro" style="margin-top:14px" onclick="document.getElementById('btn-sair').click()">Sair desta conta</button></div>`
        : `<div class="card"><h3>Não foi possível carregar os dados</h3><p style="margin-top:8px;color:var(--cinza)">${esc(err.message)}</p></div>`;
      return;
    }
    $('#tela-app').classList.remove('oculto');
    rota();
  });
}

iniciar();
