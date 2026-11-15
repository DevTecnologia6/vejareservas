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
