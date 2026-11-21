// Componente de calendário mensal (usado no painel e na página pública)
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * @param {HTMLElement} el      container
 * @param {Date} mes            qualquer dia do mês a exibir
 * @param {Object} marcados     { 'YYYY-MM-DD': 'reservado' | 'pendente' }
 * @param {Function} onClick    (iso, estado) => void
 * @param {Object} opts         { bloquearPassado: bool }
 */
export function renderCalendario(el, mes, marcados, onClick, opts = {}) {
  const ano = mes.getFullYear(), m = mes.getMonth();
  const primeiro = new Date(ano, m, 1).getDay();
  const totalDias = new Date(ano, m + 1, 0).getDate();
  const hoje = toISO(new Date());
  let html = '<div class="cal-grid">' + DIAS.map((d) => `<div class="cal-head">${d}</div>`).join('');
  for (let i = 0; i < primeiro; i++) html += '<div class="cal-vazio"></div>';
  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = toISO(new Date(ano, m, dia));
    const estado = marcados[iso] || 'livre';
    const passado = iso < hoje;
    const cls = ['cal-dia', `cal-${estado}`];
    if (iso === hoje) cls.push('cal-hoje');
    if (passado) cls.push('cal-passado');
    const desabilitado = opts.bloquearPassado && passado;
    html += `<button type="button" class="${cls.join(' ')}" data-iso="${iso}" data-estado="${estado}" ${desabilitado ? 'disabled' : ''}>
      <span>${dia}</span>${estado !== 'livre' ? '<i class="cal-ponto"></i>' : ''}</button>`;
  }
  html += '</div>';
  el.innerHTML = html;
  el.querySelectorAll('.cal-dia').forEach((b) => b.addEventListener('click', () => onClick && onClick(b.dataset.iso, b.dataset.estado)));
}

// ---- várias diárias ----
export const addDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return toISO(d); };
/** Todas as datas ocupadas por uma reserva (data inicial + nº de diárias) */
export const datasDe = (r) => { if (!r?.data) return []; const n = Math.max(1, +r.dias || 1) + (r.meia ? 1 : 0); return [...Array(n)].map((_, i) => addDias(r.data, i)); };
/** total de horas: diárias de 24h (+12h se tiver meia diária no final) */
export const horasDe = (r) => ((+r.dias || 1) > 1 ? 24 * r.dias : r.periodo === '12h' ? 12 : 24) + (r.meia ? 12 : 0);
/** Texto do período: "12h", "24h" ou "4 diárias" */
export const periodoTxt = (r) => ((+r.dias || 1) > 1 ? `${r.dias} diárias` : r.meia ? '1 diária' : r.periodo || '24h') + (r.meia ? ' + 12h' : '');
/** Data/hora de saída prevista (Date) */
export function saidaDate(r) {
  if (!r?.data || !r.horaEntrada) return null;
  const [h, m] = r.horaEntrada.split(':').map(Number);
  const d = new Date(`${r.data}T00:00:00`);
  const horas = horasDe(r);
  d.setHours(h + horas, m);
  return d;
}

// ---- horários exatos (intervalo de limpeza e extensão) ----
// Sempre no horário de Brasília (UTC-3, sem horário de verão desde 2019) — as regras do Firestore fazem a mesma conta.
const HORA_MS = 3600e3;
/** "2027-01-16", "08:00" → milissegundos */
export const msDe = (data, hora) => Date.parse(`${data}T${hora}:00-03:00`);
/** { ini, fim } em milissegundos da locação inteira */
export const iniFim = (r) => { const ini = msDe(r.data, r.horaEntrada); return { ini, fim: ini + horasDe(r) * HORA_MS }; };
/** quantas datas a locação ocupa no calendário */
export const contaDatas = (r) => Math.max(1, +r.dias || 1) + (r.meia ? 1 : 0);
/** formato da locação para um total de horas: 12 → 12h · 24 → 24h · 36 → 1 diária + 12h · 48 → 2 diárias… */
export function formaDeHoras(h) {
  if (h <= 12) return { dias: 1, periodo: '12h', meia: false };
  return { dias: Math.floor(h / 24), periodo: '24h', meia: h % 24 === 12 };
}
/** preço de tabela de um formato (mesma conta das regras do Firestore) */
export const precoForma = (f, p) => ((+f.dias || 1) > 1 ? +p.preco24 * f.dias : f.periodo === '12h' ? +p.preco12 : +p.preco24) + (f.meia ? +p.preco12 : 0);
/** a ocupação ainda vale? (pré-reserva não paga some quando o prazo vence) */
export const ocupacaoValida = (o, agora = Date.now()) => !(o.status === 'pendente' && o.expiraEm && agora > o.expiraEm);
/**
 * Procura choque de horário considerando o intervalo de limpeza.
 * @param {number} ini @param {number} fim  locação nova (ms)
 * @param {Array} ocupacoes  docs de "ocupacao" com ini/fim
 * @param {number} folgaH    horas livres exigidas entre uma locação e outra
 * @param {Array} ignorar    datas (ids) que não contam (ex.: a própria reserva)
 * @returns o doc em conflito, ou null
 */
export function choqueHorario(ini, fim, ocupacoes, folgaH = 0, ignorar = []) {
  const folga = (+folgaH || 0) * HORA_MS;
  return ocupacoes.find((o) => ocupacaoValida(o) && !ignorar.includes(o.id) && o.ini && o.fim && o.fim + folga > ini && fim + folga > o.ini) || null;
}

// "entrada 16/11 às 08:00 · saída 19/11 às 08:00"
export function entradaSaidaTxt(r) {
  const s = saidaDate(r);
  if (!s) return r?.horaEntrada ? 'entrada ' + r.horaEntrada : '';
  const dd = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const hh = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const e = new Date(`${r.data}T${r.horaEntrada}:00`);
  return `entrada ${dd(e)} às ${hh(e)} · saída ${dd(s)} às ${hh(s)}`;
}
