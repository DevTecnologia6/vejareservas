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
export const datasDe = (r) => { if (!r?.data) return []; const n = Math.max(1, +r.dias || 1); return [...Array(n)].map((_, i) => addDias(r.data, i)); };
/** Texto do período: "12h", "24h" ou "4 diárias" */
export const periodoTxt = (r) => ((+r.dias || 1) > 1 ? `${r.dias} diárias` : r.periodo || '24h');
/** Data/hora de saída prevista (Date) */
export function saidaDate(r) {
  if (!r?.data || !r.horaEntrada) return null;
  const [h, m] = r.horaEntrada.split(':').map(Number);
  const d = new Date(`${r.data}T00:00:00`);
  const horas = (+r.dias || 1) > 1 ? 24 * r.dias : r.periodo === '12h' ? 12 : 24;
  d.setHours(h + horas, m);
  return d;
}
