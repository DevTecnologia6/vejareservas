// =====================================================================
//  VejaReservas — contrato de locação por temporada
//  Gera o contrato preenchido e abre a tela para baixar em PDF / imprimir.
// =====================================================================

export const CLAUSULAS_PADRAO = `CLÁUSULA 3ª – DA LIMPEZA
A limpeza pós-evento é opcional e, quando contratada, está discriminada no valor deste contrato. Não sendo contratada, o LOCATÁRIO deverá devolver o imóvel limpo e organizado, com o lixo recolhido e ensacado, sob pena de cobrança da taxa de limpeza.

CLÁUSULA 4ª – DO USO E DOS CUIDADOS COM O ESPAÇO
4.1. O imóvel destina-se exclusivamente ao evento informado na reserva, sendo proibido sublocar, ceder ou emprestar o espaço a terceiros.
4.2. O LOCATÁRIO é responsável por todos os seus convidados e responde por qualquer dano causado por eles ao imóvel, aos móveis e às instalações.
4.3. É proibido pregar, colar, furar ou pintar paredes, portas e móveis, bem como utilizar fogos de artifício, velas ou materiais inflamáveis sem autorização.
4.4. O LOCATÁRIO deverá respeitar a vizinhança, as normas de convivência e a legislação municipal sobre ruídos e horários.
4.5. Não é permitido o uso de substâncias ilícitas no imóvel. O descumprimento autoriza o LOCADOR a encerrar a locação imediatamente, sem devolução de valores.

CLÁUSULA 5ª – DOS CUIDADOS COM A PISCINA
5.1. O uso da piscina é de inteira responsabilidade do LOCATÁRIO. Crianças e pessoas que não sabem nadar só poderão utilizá-la sob supervisão constante de um adulto responsável.
5.2. São proibidos saltos, mergulhos de cabeça, brincadeiras perigosas e o uso da piscina por pessoas alcoolizadas.
5.3. É proibido levar copos, garrafas ou qualquer objeto de vidro para a área da piscina, bem como alimentos dentro da água.
5.4. É proibido adicionar qualquer produto à água ou mexer no sistema de filtragem e nos equipamentos da piscina.
5.5. O LOCADOR não se responsabiliza por acidentes decorrentes do uso inadequado da piscina ou do descumprimento destas regras.

CLÁUSULA 6ª – DOS UTENSÍLIOS E EQUIPAMENTOS
6.1. Os móveis, utensílios de cozinha, eletrodomésticos, mesas, cadeiras e demais equipamentos do imóvel devem ser utilizados com cuidado e devolvidos limpos, nas mesmas condições em que foram recebidos.
6.2. Itens quebrados, danificados ou faltantes serão cobrados do LOCATÁRIO pelo valor de reposição ou conserto.

CLÁUSULA 7ª – DA VISTORIA E DOS DANOS
7.1. O imóvel será entregue em perfeito estado de conservação e limpeza, podendo ser vistoriado na entrada e na saída.
7.2. Os danos constatados na vistoria de saída serão comunicados ao LOCATÁRIO, que se obriga a ressarci-los no prazo de até 5 (cinco) dias.

CLÁUSULA 8ª – DA DESISTÊNCIA E DO CANCELAMENTO
8.1. O LOCATÁRIO poderá solicitar o cancelamento da reserva em até 7 (sete) dias após a confirmação do pagamento, pelo site de reservas, com devolução dos valores pagos.
8.2. Após esse prazo, não será possível cancelar a reserva nem haverá devolução dos valores pagos.
8.3. A não utilização do imóvel na data contratada, por qualquer motivo, não dá direito a devolução de valores.

CLÁUSULA 9ª – DO HORÁRIO
O LOCATÁRIO deverá respeitar rigorosamente os horários de entrada e saída. A permanência além do horário de saída poderá ser cobrada proporcionalmente.`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '____/____/______');
const linha = (v, n = 30) => (v ? esc(v) : '_'.repeat(n));
export const cpfFmt = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (c || ''); };
export const cpfMascarado = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 11 ? `***.${d.slice(3, 6)}.***-${d.slice(9)}` : '***'; };

export function cpfValido(c) {
  const d = String(c || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}

function saida(r) {
  if (!r.data || !r.horaEntrada) return '';
  const [h, m] = r.horaEntrada.split(':').map(Number);
  const d = new Date(`${r.data}T00:00:00`);
  d.setHours(h + ((+r.dias || 1) > 1 ? 24 * r.dias : r.periodo === '12h' ? 12 : 24) + (r.meia ? 12 : 0), m);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * @param {Object} r   reserva (cliente, clienteCpf, clienteEndereco, data, periodo, horaEntrada, valor, taxaLimpeza, pagamentos, aceiteContrato)
 * @param {Object} k   dados do contrato { locadorNome, locadorCpf, locadorEndereco, imovelEndereco, foro, clausulas, assinatura }
 * @param {Object} op  { previa: true } esconde CPF completo do locador
 */
export function htmlContrato(r, k, op = {}) {
  const total = (+r.valor || 0) + (+r.taxaLimpeza || 0);
  const pago = (r.pagamentos || []).reduce((s, p) => s + (+p.valor || 0), 0);
  const formas = [...new Set((r.pagamentos || []).map((p) => p.forma))].join(', ');
  const cpfLocador = op.previa ? (k.locadorCpfMasc || cpfMascarado(k.locadorCpf)) : cpfFmt(k.locadorCpf);
  const aceite = r.aceiteContrato ? new Date(r.aceiteContrato) : null;
  const hojeExt = new Date(k.geradoEm || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const clausulas = esc(k.clausulas || CLAUSULAS_PADRAO).split(/\n\s*\n/).map((p) => {
    const linhas = p.split('\n');
    return /^CLÁUSULA/i.test(linhas[0]) ? `<h4>${linhas[0]}</h4><p>${linhas.slice(1).join('<br>')}</p>` : `<p>${linhas.join('<br>')}</p>`;
  }).join('');

  return `
  <div class="contrato-doc">
    ${op.previa ? '<div class="contrato-previa">PRÉVIA — o contrato definitivo fica disponível após a confirmação do pagamento</div>' : ''}
    <h2>CONTRATO DE LOCAÇÃO DE IMÓVEL POR TEMPORADA PARA EVENTO</h2>
    <p class="contrato-sub">Lei nº 8.245/1991, art. 48 e seguintes</p>

    <p><b>LOCADOR:</b> ${linha(k.locadorNome, 40)}, inscrito no CPF sob nº ${linha(cpfLocador, 14)}, residente e domiciliado em ${linha(k.locadorEndereco, 40)}.</p>
    <p><b>LOCATÁRIO:</b> ${linha(r.cliente, 40)}, inscrito(a) no CPF sob nº ${linha(cpfFmt(r.clienteCpf), 14)}, residente e domiciliado(a) em ${linha(r.clienteEndereco, 40)}${r.telefone ? `, telefone ${esc(r.telefone)}` : ''}${r.clienteEmail ? `, e-mail ${esc(r.clienteEmail)}` : ''}.</p>
    <p>As partes acima identificadas têm entre si, justo e contratado, o presente contrato, que se regerá pelas cláusulas seguintes.</p>

    <h4>CLÁUSULA 1ª – DO OBJETO E DO PERÍODO</h4>
    <p>O LOCADOR cede ao LOCATÁRIO, para uso temporário${r.evento ? ` destinado ao evento <b>${esc(r.evento)}</b>` : ''}, o imóvel denominado <b>${esc(k.nomeEspaco || 'Espaço Veja')}</b>, situado em ${linha(k.imovelEndereco || k.locadorEndereco, 40)}, pelo período de <b>${(+r.dias || 1) > 1 ? `${r.dias} diárias (24 horas cada)` : r.meia ? '1 diária (24 horas)' : esc(r.periodo || '___')}${r.meia ? ' + meia diária (12 horas)' : ''}</b>, com entrada em <b>${br(r.data)} às ${esc(r.horaEntrada || '___:___')}</b> e saída em <b>${saida(r) || '____/____/______'}</b>.</p>

    <h4>CLÁUSULA 2ª – DO VALOR E DO PAGAMENTO</h4>
    <p>Pela locação, o LOCATÁRIO pagará o valor total de <b>${fmt(total)}</b>, sendo ${fmt(r.valor)} referentes à locação${(+r.dias || 1) > 1 ? ` (${r.dias} diárias${r.meia ? ' + meia diária' : ''})` : r.meia ? ' (1 diária + meia diária)' : ''}${+r.taxaLimpeza > 0 ? ` e ${fmt(r.taxaLimpeza)} referentes à limpeza pós-evento, contratada pelo LOCATÁRIO` : ', sem contratação da limpeza pós-evento'}. ${pago > 0 ? `Já foi pago o valor de <b>${fmt(pago)}</b>${formas ? ` (${esc(formas)})` : ''}` : 'O pagamento será realizado conforme combinado entre as partes'}${pago > 0 && total - pago > 0 ? `, restando <b>${fmt(total - pago)}</b> a serem quitados até a entrada no imóvel` : pago > 0 ? ', estando o valor integralmente quitado' : ''}.</p>

    ${clausulas}

    <h4>CLÁUSULA FINAL – DO FORO</h4>
    <p>Fica eleito o foro da comarca de ${linha(k.foro, 20)} para dirimir quaisquer dúvidas oriundas deste contrato. O LOCATÁRIO declara ter lido e aceitado eletronicamente todas as cláusulas deste contrato no site oficial de reservas.</p>

    <p class="contrato-data">${esc(k.foro || '')}${k.foro ? ', ' : ''}${hojeExt}.</p>

    <div class="contrato-assin">
      <div>
        ${k.assinatura && !op.previa ? `<img src="${k.assinatura}" alt="Assinatura do locador">` : '<div class="assin-espaco"></div>'}
        <span class="assin-linha"></span>
        <b>${esc(k.locadorNome || 'LOCADOR')}</b><small>LOCADOR · CPF ${esc(cpfLocador || '')}</small>
      </div>
      <div>
        ${aceite ? `<div class="assin-eletronica">Aceito eletronicamente em<br>${aceite.toLocaleDateString('pt-BR')} às ${aceite.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${r.clienteEmail ? `<br>pela conta ${esc(r.clienteEmail)}` : ''}</div>` : '<div class="assin-espaco"></div>'}
        <span class="assin-linha"></span>
        <b>${esc(r.cliente || 'LOCATÁRIO')}</b><small>LOCATÁRIO · CPF ${esc(cpfFmt(r.clienteCpf) || '')}</small>
      </div>
    </div>
  </div>`;
}

// Carrega a biblioteca de PDF só quando precisa (arquivo grande)
let carregandoPdf;
function carregarHtml2pdf() {
  if (window.html2pdf) return Promise.resolve();
  carregandoPdf ||= new Promise((ok, erro) => {
    const sc = document.createElement('script');
    sc.src = 'js/vendor/html2pdf.bundle.min.js';
    sc.onload = ok; sc.onerror = () => { carregandoPdf = null; erro(new Error('Falha ao carregar o gerador de PDF')); };
    document.head.appendChild(sc);
  });
  return carregandoPdf;
}

const nomeArquivo = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.pdf';

// Abre o contrato em tela cheia com botões para baixar o PDF e imprimir
export function abrirContrato(html, titulo = 'Contrato de locação') {
  document.getElementById('contrato-vis')?.remove();
  const el = document.createElement('div');
  el.id = 'contrato-vis';
  el.innerHTML = `
    <div class="contrato-barra">
      <b>${esc(titulo)}</b>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ouro btn-peq" id="contrato-pdf">⬇ Baixar PDF</button>
        <button class="btn btn-claro btn-peq" id="contrato-imprimir">🖨 Imprimir</button>
        <button class="btn btn-claro btn-peq" id="contrato-fechar">Fechar</button>
      </div>
    </div>
    <div class="contrato-scroll">${html}</div>
    <p class="contrato-dica" id="contrato-msg">O arquivo PDF é salvo na pasta de downloads do seu celular ou computador.</p>`;
  document.body.appendChild(el);
  document.body.classList.add('com-contrato');
  const fechar = () => { el.remove(); document.body.classList.remove('com-contrato'); };
  el.querySelector('#contrato-fechar').onclick = fechar;
  el.querySelector('#contrato-imprimir').onclick = () => { const t = document.title; document.title = titulo; window.print(); document.title = t; };
  el.querySelector('#contrato-pdf').onclick = async (e) => {
    const btn = e.currentTarget, msg = el.querySelector('#contrato-msg');
    btn.disabled = true; btn.textContent = 'Gerando PDF…';
    try {
      await carregarHtml2pdf();
      const doc = el.querySelector('.contrato-doc').cloneNode(true);
      doc.classList.add('contrato-pdf');
      doc.querySelector('.contrato-previa')?.setAttribute('data-html2canvas-ignore', 'false');
      await window.html2pdf().set({
        margin: [14, 14, 16, 14],
        filename: nomeArquivo(titulo),
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['h4', '.contrato-assin', 'p'] }
      }).from(doc).save();
      msg.innerHTML = '✅ PDF baixado! Procure na pasta <b>Downloads</b>.';
    } catch (err) {
      console.error(err);
      msg.innerHTML = 'Não foi possível gerar o PDF neste aparelho. Use o botão <b>Imprimir</b> e escolha <b>Salvar como PDF</b>.';
    }
    btn.disabled = false; btn.textContent = '⬇ Baixar PDF';
  };
}
