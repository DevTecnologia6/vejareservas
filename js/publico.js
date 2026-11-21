// =====================================================================
//  Calendário público — datas livres, conta do cliente, pré-reserva e Pix
// =====================================================================
import * as db from './db.js';
import './limites.js';
import { renderCalendario, MESES, addDias, datasDe, periodoTxt, saidaDate, entradaSaidaTxt, horasDe, iniFim, contaDatas, formaDeHoras, precoForma, choqueHorario, ocupacaoValida } from './calendar.js';
import { gerarPix, qrSVG } from './pix.js';
import { abrirVisualizador } from './fotos.js';
import { htmlContrato, abrirContrato, cpfFmt, cpfValido, CLAUSULAS_PADRAO } from './contrato.js';
import { htmlDadosPessoais, htmlEndereco, ligarCampos, lerCadastro, mascaraCpf, mascaraFone } from './campos.js';

const $ = (s, el = document) => el.querySelector(s);
const br = (iso) => iso.split('-').reverse().join('/');
const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const foneFmt = (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d; };
const ZAP = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>';
const CADEADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ST_SOL = { cancelada: ['Cancelada', 'st-cancelada'], aguardando: ['Aguardando pagamento', 'st-pendente'], informado: ['Pagamento informado', 'st-pendente'], recusada: ['Não aprovada', 'st-cancelada'], expirada: ['Expirada', 'st-cancelada'] };
// situação da pré-reserva considerando o prazo de pagamento
const situacaoSol = (s) => (s.status && s.status !== 'aguardando' ? s.status : s.pagoInformadoEm ? 'informado' : s.expiraEm && Date.now() > s.expiraEm ? 'expirada' : 'aguardando');
const mmss = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
let timers = [];
const limparTimers = () => { timers.forEach(clearInterval); timers = []; };
function contagem(el, expiraEm, aoAcabar) {
  const tick = () => { const r = expiraEm - Date.now(); el.textContent = mmss(r); if (r <= 0) { clearInterval(id); aoAcabar && aoAcabar(); } };
  const id = setInterval(tick, 1000); timers.push(id); tick();
}
// datas que a pré-reserva segura (na extensão, só as datas novas depois da reserva atual)
const datasMarcadas = (sol) => datasDe(sol).filter((d) => !sol.marcaIni || d >= sol.marcaIni);
const horario = (sol) => (sol.ini ? { ini: sol.ini, fim: sol.fim } : {});
// cliente avisa que pagou: a pré-reserva para de expirar e a data fica segurada até o dono aprovar
async function informarPagamento(id, sol) {
  await db.update('solicitacoes', id, { pagoInformadoEm: new Date().toISOString() });
  for (const d of datasMarcadas(sol)) { try { await db.set('ocupacao', d, { status: 'pendente', sol: id, ...horario(sol) }); } catch (e) { console.warn(e); } }
}
// o cliente já tem uma pré-reserva aguardando pagamento ou aprovação? (só pode ter uma por vez)
async function pendenciaAtiva() {
  const sols = await db.query('solicitacoes', 'uid', usuario.uid).catch(() => []);
  return sols.find((s) => ['aguardando', 'informado'].includes(situacaoSol(s))) || null;
}
const msgPendencia = (s) => `Você já tem a pré-reserva <b>${esc(s.codigo)}</b> (${br(s.data)}) ${situacaoSol(s) === 'informado' ? 'aguardando a nossa confirmação' : 'aguardando pagamento'}. Só é possível ter uma por vez: conclua ou aguarde a resposta dela em <b>Minhas reservas</b>.`;
const ST_RES = { pendente: ['Pendente', 'st-pendente'], confirmada: ['Confirmada', 'st-confirmada'], congelada: ['Congelada (crédito)', 'st-congelada'], concluida: ['Concluída', 'st-concluida'], cancelada: ['Cancelada', 'st-cancelada'] };

let mes = new Date(); mes.setDate(1);
let marcados = {};
let ocupacoes = [];   // docs de "ocupacao" (datas + horário de entrada/saída, sem dados de clientes)
let info = { nome: 'Espaço Veja', whatsapp: '', preco12: 770, preco24: 1000, taxaLimpeza: 75, horaEntrada: '09:00', horarios: '08:00, 09:00, 10:00, 12:00, 14:00', sinalPct: 50, preReserva: true, regras: '', pix: null, prazoPagamentoMin: 30, intervaloH: 0 };
let usuario = null;   // { uid, email, emailVerified }
let perfil = null;    // { nome, telefone }
let fotos = [];

const listaHorarios = () => String(info.horarios || info.horaEntrada || '09:00').split(/[,;\s]+/).filter((h) => /^\d{1,2}:\d{2}$/.test(h)).map((h) => h.padStart(5, '0'));
const folgaH = () => +info.intervaloH || 0;
// horários de entrada que não batem com outra locação (respeitando o intervalo de limpeza)
const horariosLivres = (iso, forma) => listaHorarios().filter((h) => {
  const { ini, fim } = iniFim({ data: iso, horaEntrada: h, ...forma });
  return ini > Date.now() && !choqueHorario(ini, fim, ocupacoes, folgaH());
});
const txtFolga = () => (folgaH() ? `Precisamos de ${folgaH()}h livres entre uma locação e outra para a limpeza da casa.` : '');

// ---------------------------------------------------------------- fotos
async function carregarFotos() {
  fotos = (await db.list('fotos').catch(() => [])).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  if (!fotos.length) return;
  const max = 8;
  $('#galeria').innerHTML = fotos.slice(0, max).map((f, i) => `<button data-i="${i}" aria-label="${esc(f.legenda || 'Foto ' + (i + 1))}"><img src="${f.thumb}" alt="${esc(f.legenda || '')}" loading="lazy">${i === max - 1 && fotos.length > max ? `<span class="mais">+${fotos.length - max + 1} fotos</span>` : ''}</button>`).join('');
  $('#galeria').querySelectorAll('button').forEach((b) => (b.onclick = () => verFotos(+b.dataset.i)));
  $('#ver-fotos').textContent = `Ver todas (${fotos.length})`;
  $('#ver-fotos').onclick = () => verFotos(0);
  $('#card-fotos').classList.remove('oculto');
}
const verFotos = (i) => abrirVisualizador(fotos, i, async (id) => (await db.get('fotosFull', id))?.img);

// ---------------------------------------------------------------- site oficial
const host = location.hostname;
const siteOficial = !db.dominioOficial || [db.dominioOficial, 'www.' + db.dominioOficial, ...(db.dominiosPermitidos || []), 'localhost', '127.0.0.1'].includes(host);

function montarAlertaFalso() {
  if (siteOficial) return;
  document.body.insertAdjacentHTML('afterbegin', `<div class="alerta-falso">⚠️ <b>ATENÇÃO: este NÃO é o site oficial do Espaço Veja.</b> Não crie conta, não informe sua senha e não faça pagamentos aqui. O site oficial é <b>${esc(db.dominioOficial)}</b>.</div>`);
}

function montarSelo(alvo = '#selo') {
  const endereco = db.dominioOficial || host;
  $(alvo).innerHTML = `<button class="selo-seguro ${siteOficial ? '' : 'selo-alerta'}" data-selo>${CADEADO}<span><b>${siteOficial ? 'Site oficial e seguro' : 'Endereço não oficial'}</b><small>${esc(endereco)} · toque para saber mais</small></span></button>`;
  $(alvo).querySelector('[data-selo]').onclick = () => abrirModal(`${CADEADO.replace('<svg', '<svg width="20" height="20" style="vertical-align:-4px;color:var(--verde)"')} Como reservar com segurança`, `
    <div class="dicas-seg">
      <p><b>1. Confira o endereço.</b> O único site oficial do ${esc(info.nome)} é <b class="dominio">${esc(endereco)}</b>, com o cadeado 🔒 na barra do navegador.</p>
      ${info.pix?.nome ? `<p><b>2. Confira o recebedor do Pix.</b> Antes de confirmar o pagamento no app do banco, verifique se o nome que aparece é <b>${esc(info.pix.nome)}</b>. Se for outro nome, <b>não pague</b>.</p>` : ''}
      ${info.whatsapp ? `<p><b>3. Confira o WhatsApp.</b> Nosso número oficial é <b>${esc(foneFmt(info.whatsapp.replace(/^55/, '')))}</b>.</p>` : ''}
      <p><b>4. Não confie em sites falsos</b>, perfis copiados ou links enviados por desconhecidos com "promoções". Na dúvida, fale com a gente antes de pagar.</p>
      <p style="color:var(--cinza);font-size:13px">Seus dados ficam protegidos: o calendário mostra só as datas ocupadas, nunca nomes ou valores de outros clientes, e sua conta é protegida por senha e confirmação de e-mail.</p>
    </div>`);
}

// ---------------------------------------------------------------- calendário
const linkZap = (texto) => `https://wa.me/${info.whatsapp}?text=${encodeURIComponent(texto)}`;
const diaExtenso = (iso) => { const s = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };

function desenhar() {
  $('#mes').textContent = `${MESES[mes.getMonth()]} ${mes.getFullYear()}`;
  const atual = new Date(); atual.setDate(1);
  $('#ant').disabled = mes <= atual;
  $('#ant').style.opacity = mes <= atual ? 0.35 : 1;
  renderCalendario($('#cal'), mes, marcados, selecionar, { bloquearPassado: true });
  pintarSelecao();
}

// ---------------------------------------------------------------- seleção de datas (uma ou várias seguidas)
let selecao = { ini: null, fim: null };
const diasSelecao = () => (selecao.ini ? datasDe({ data: selecao.ini, dias: selecao.fim ? diffDias(selecao.ini, selecao.fim) + 1 : 1 }) : []);
const diffDias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
const brCurto = (iso) => iso.split('-').reverse().slice(0, 2).join('/');

function pintarSelecao() {
  document.querySelectorAll('.cal-dia.sel').forEach((b) => b.classList.remove('sel'));
  diasSelecao().forEach((iso) => document.querySelector(`.cal-dia[data-iso="${iso}"]`)?.classList.add('sel'));
}

function selecionar(iso, estado) {
  const sel = $('#sel');
  if (estado !== 'livre') {
    sel.innerHTML = `<b>${br(iso)}</b><span style="color:var(--cinza)">Esta data já está ${estado === 'pendente' ? 'em negociação' : 'reservada'}. Escolha outro dia 😉</span>`;
    return;
  }
  // 1º toque escolhe o dia; 2º toque em um dia posterior escolhe o intervalo
  if (!selecao.ini || selecao.fim || iso < selecao.ini) selecao = { ini: iso, fim: null };
  else if (iso === selecao.ini) selecao = { ini: iso, fim: null };
  else {
    const intervalo = datasDe({ data: selecao.ini, dias: diffDias(selecao.ini, iso) + 1 });
    const ocupada = intervalo.find((d) => marcados[d]);
    if (ocupada) { selecao = { ini: iso, fim: null }; pintarSelecao(); sel.innerHTML = `<b>O dia ${br(ocupada)} já está ocupado.</b><span style="color:var(--cinza)">Escolha datas seguidas sem dias ocupados no meio. Começamos uma nova seleção em ${brCurto(iso)}.</span>`; return; }
    if (intervalo.length > 30) { selecao = { ini: iso, fim: null }; pintarSelecao(); sel.innerHTML = '<b>Máximo de 30 diárias por reserva.</b>'; return; }
    selecao.fim = iso;
  }
  pintarSelecao();
  const dias = diasSelecao();
  // dia livre no calendário, mas sem nenhum horário que respeite o intervalo de limpeza com as locações vizinhas
  const formaMin = dias.length > 1 ? { dias: dias.length, periodo: '24h' } : { dias: 1, periodo: '12h' };
  if (!horariosLivres(dias[0], formaMin).length) {
    selecao = { ini: null, fim: null }; pintarSelecao();
    sel.innerHTML = `<b>${dias.length > 1 ? `${brCurto(dias[0])} a ${brCurto(dias.at(-1))}` : br(dias[0])}: sem horário de entrada disponível</b><span style="color:var(--cinza)">Há uma locação colada a ${dias.length > 1 ? 'essas datas' : 'este dia'}. ${txtFolga()} Escolha outro dia 😉</span>`;
    return;
  }
  const titulo = dias.length > 1 ? `${brCurto(dias[0])} a ${brCurto(dias.at(-1))} · ${dias.length} diárias` : `${diaExtenso(iso)} está livre!`;
  const botoes = [];
  if (info.preReserva && siteOficial) botoes.push(`<button class="btn btn-ouro" id="btn-reservar">Reservar ${dias.length > 1 ? `${dias.length} diárias` : 'agora'}</button>`);
  if (info.whatsapp) botoes.push(`<a class="btn ${info.preReserva ? 'btn-claro' : 'btn-verde'}" target="_blank" rel="noopener" href="${linkZap(`Olá! Vi no calendário que o ${info.nome} está livre ${dias.length > 1 ? `de ${br(dias[0])} a ${br(dias.at(-1))}` : `no dia ${br(iso)}`}. Gostaria de mais informações para reservar!`)}">${ZAP} Conversar no WhatsApp</a>`);
  sel.innerHTML = `<b>${titulo}</b>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${botoes.join('') || '<span style="color:var(--cinza)">Entre em contato para reservar.</span>'}</div>
    <small style="display:block;color:var(--cinza);margin-top:10px">${dias.length > 1 ? '<button class="btn-link" id="limpar-sel" style="font-size:13px">Limpar seleção</button>' : '💡 Quer mais de um dia? Toque no último dia desejado para escolher várias datas seguidas.'}</small>`;
  $('#limpar-sel')?.addEventListener('click', () => { selecao = { ini: null, fim: null }; pintarSelecao(); sel.innerHTML = ''; });
  const ini = dias[0], n = dias.length;
  $('#btn-reservar')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    const pend = await pendenciaAtiva();
    if (pend) { sel.innerHTML = `<b>Você já tem uma pré-reserva em andamento</b><span style="color:var(--cinza)">${msgPendencia(pend)}</span>`; return; }
    perfil?.cpf && perfil?.end?.cep ? abrirPreReserva(ini, n) : abrirDadosContrato(() => abrirPreReserva(ini, n));
    if ($('#btn-reservar')) $('#btn-reservar').disabled = false;
  });
}

// ---------------------------------------------------------------- modal
function abrirModal(titulo, corpo, aoMontar) {
  const raiz = $('#modal-raiz');
  raiz.innerHTML = `<div class="modal-fundo"><div class="modal" role="dialog">
    <div class="modal-topo"><h3>${titulo}</h3><button class="btn-icone" data-fechar><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
    <div class="modal-corpo">${corpo}</div></div></div>`;
  $('[data-fechar]', raiz).onclick = fecharModal;
  aoMontar && aoMontar($('.modal', raiz));
}
const fecharModal = () => { limparTimers(); $('#modal-raiz').innerHTML = ''; };

// ---------------------------------------------------------------- tela de acesso (obrigatória)
function abrirAcesso(titulo, corpo, aoMontar) {
  const alvo = $('#acesso-corpo');
  alvo.innerHTML = `<h2 class="acesso-titulo">${titulo}</h2>${corpo}`;
  aoMontar && aoMontar(alvo);
}

// ---------------------------------------------------------------- conta do cliente
const ERROS = {
  'auth/email-already-in-use': 'Este e-mail já tem conta. Use "Entrar".',
  'auth/invalid-credential': 'E-mail ou senha incorretos. Toque no 👁 para conferir a senha ou use "Esqueci minha senha".',
  'auth/network-request-failed': 'Sem conexão com a internet. Verifique e tente de novo.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  'auth/unauthorized-domain': 'Este endereço não está autorizado. Use o site oficial.'
};
const msgErro = (e) => ERROS[e?.code] || ('Algo deu errado. Tente novamente.' + (e?.code ? ` (${e.code})` : ''));
// botão 👁 para ver a senha digitada (evita erro de digitação no celular)
function olhoSenha(raiz) {
  raiz.querySelectorAll('input[type=password]').forEach((inp) => {
    if (inp.dataset.olho) return; inp.dataset.olho = '1';
    const caixa = document.createElement('span'); caixa.className = 'senha-caixa';
    inp.parentNode.insertBefore(caixa, inp); caixa.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'senha-olho'; b.textContent = '👁'; b.title = 'Mostrar senha';
    b.onclick = () => { const ver = inp.type === 'password'; inp.type = ver ? 'text' : 'password'; b.textContent = ver ? '🙈' : '👁'; };
    caixa.appendChild(b);
  });
}

async function carregarPerfil() {
  if (!usuario) { perfil = null; return; }
  const uid = usuario.uid;
  const p = await db.get('clientes', uid).catch(() => null);
  if (usuario?.uid === uid && (p || !perfil || perfil._uid !== uid)) perfil = p ? { ...p, _uid: uid } : null;
}

function atualizarBarraConta() {
  const el = $('#conta');
  if (!usuario) { el.innerHTML = ''; return; }
  const nome = (perfil?.nome || usuario.email).split(' ')[0];
  el.innerHTML = `<span>Olá, <b>${esc(nome)}</b></span>
    <button class="btn btn-claro btn-peq" id="btn-minhas">Minhas reservas</button>
    <button class="btn-link" id="btn-sair-cli">Sair</button>`;
  $('#btn-minhas').onclick = () => (usuario.emailVerified ? abrirMinhas() : abrirConfirmarEmail());
  $('#btn-sair-cli').onclick = async () => { await db.clienteSair(); location.reload(); };
}

function abrirConta(aba = 'cadastro', depois) {
  const cad = aba === 'cadastro';
  abrirAcesso(cad ? 'Criar sua conta' : 'Entrar na sua conta', `
    <p class="acesso-sub">${cad ? 'Crie sua conta para ver as datas disponíveis, as fotos e reservar.' : 'Entre para ver as datas disponíveis, as fotos e reservar.'}</p>
    <div class="chips" style="margin-bottom:16px">
      <button class="chip ${cad ? 'ativo' : ''}" data-aba="cadastro">Criar conta</button>
      <button class="chip ${!cad ? 'ativo' : ''}" data-aba="entrar">Já tenho conta</button>
    </div>
    <form id="form-conta" class="grade-form">
      ${cad ? htmlDadosPessoais() + htmlEndereco() : ''}
      <label class="campo inteiro">E-mail${cad ? ' *' : ''}<input type="email" name="email" required autocomplete="email" placeholder="Ex.: maria@gmail.com"></label>
      <label class="campo ${cad ? '' : 'inteiro'}">Senha${cad ? ' *' : ''}<input type="password" name="senha" required minlength="6" autocomplete="${cad ? 'off' : 'current-password'}" placeholder="${cad ? 'Mínimo 6 caracteres' : 'Sua senha'}"></label>
      ${cad ? `<label class="campo">Confirmar senha *<input type="password" name="senha2" required minlength="6" autocomplete="off" placeholder="Digite a senha novamente"></label>
      <p class="inteiro" style="font-size:12.5px;color:var(--cinza);line-height:1.45">🔑 <b>Anote a sua senha:</b> você vai usá-la para entrar em outros aparelhos. Se o celular sugerir uma "senha forte" automática, prefira criar a sua.</p>
      <p class="inteiro" style="font-size:12px;color:var(--cinza)">* Todos os campos são obrigatórios.</p>` : ''}
      <div class="erro inteiro" id="conta-erro"></div>
      <button class="btn btn-ouro btn-bloco inteiro" type="submit">${cad ? 'Criar conta' : 'Entrar'}</button>
      ${cad ? `<p class="inteiro nota-seg">${CADEADO} Vamos enviar um link de confirmação para o seu e-mail. Sua senha é criptografada e nunca fica visível para ninguém.</p>`
            : `<button type="button" class="btn-link inteiro" id="esqueci">Esqueci minha senha</button>`}
    </form>`, (m) => {
    m.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => abrirConta(b.dataset.aba, depois)));
    const f = $('#form-conta', m);
    ligarCampos(f); olhoSenha(f);
    $('#esqueci', m)?.addEventListener('click', async () => {
      if (!f.email.value) return ($('#conta-erro', m).textContent = 'Digite seu e-mail acima primeiro.');
      try { await db.recuperarSenha(f.email.value.trim()); $('#conta-erro', m).innerHTML = '<span style="color:var(--verde)">Enviamos um link para redefinir sua senha. Confira seu e-mail (e o spam).</span>'; }
      catch (e) { $('#conta-erro', m).textContent = msgErro(e); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const erro = $('#conta-erro', m);
      let cadastro;
      if (cad) {
        const r = lerCadastro(new FormData(f));
        if (r.erro) return (erro.textContent = r.erro);
        if (!cpfValido(r.dados.cpf)) return (erro.textContent = 'CPF inválido. Confira os 11 números.');
        if (d.senha !== d.senha2) return (erro.textContent = 'As senhas não conferem.');
        cadastro = r.dados;
      }
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Aguarde…';
      try {
        if (cad) {
          usuario = await db.clienteCadastrar(d.email.trim(), d.senha);
          const dadosPerfil = { ...cadastro, email: d.email.trim(), criadoEm: new Date().toISOString() };
          perfil = { ...dadosPerfil, _uid: usuario.uid };
          await db.set('clientes', usuario.uid, dadosPerfil);
        } else {
          usuario = await db.clienteEntrar(d.email.trim(), d.senha);
          await carregarPerfil();
        }
        atualizarBarraConta();
        if (!usuario.emailVerified) abrirConfirmarEmail(depois);
        else if (!perfil) abrirCompletarPerfil(depois);
        else { fecharModal(); depois && depois(); }
      } catch (err) {
        console.error(err); btn.disabled = false; btn.textContent = cad ? 'Criar conta' : 'Entrar';
        erro.textContent = msgErro(err);
      }
    };
  });
}

function abrirConfirmarEmail(depois) {
  abrirAcesso('Confirme seu e-mail', `
    <div style="text-align:center">
      <div style="font-size:46px;margin-bottom:8px">📧</div>
      <p>Enviamos um link de confirmação para<br><b>${esc(usuario.email)}</b></p>
      <p style="color:var(--cinza);font-size:14px;margin:10px 0 18px">Abra seu e-mail, clique no link e depois volte aqui e toque em <b>Já confirmei</b>. Não achou? Olhe na caixa de spam.</p>
      <div class="erro" id="conf-erro"></div>
      <div style="display:grid;gap:10px">
        <button class="btn btn-ouro btn-bloco" id="ja-confirmei">Já confirmei</button>
        <button class="btn btn-claro btn-bloco" id="reenviar">Reenviar e-mail</button>
        <button class="btn-link" id="trocar-conta">Usar outra conta</button>
      </div>
    </div>`, (m) => {
    $('#ja-confirmei', m).onclick = async () => {
      if (await db.clienteVerificarEmail()) {
        usuario.emailVerified = true; atualizarBarraConta();
        if (!perfil) await carregarPerfil();
        if (!perfil) return abrirCompletarPerfil(depois);
        fecharModal(); depois && depois();
      } else $('#conf-erro', m).textContent = 'Ainda não identificamos a confirmação. Clique no link do e-mail e tente de novo.';
    };
    $('#trocar-conta', m).onclick = () => db.clienteSair();
    $('#reenviar', m).onclick = async (e) => {
      try { await db.clienteReenviarConfirmacao(); e.target.textContent = 'E-mail reenviado ✓'; e.target.disabled = true; }
      catch (err) { $('#conf-erro', m).textContent = msgErro(err); }
    };
  });
}

function abrirCompletarPerfil(depois) {
  abrirAcesso('Complete seu cadastro', `
    <p class="acesso-sub">Todos os campos são obrigatórios.</p>
    <form id="form-perfil" class="grade-form">
      ${htmlDadosPessoais(perfil || {})}
      ${htmlEndereco(perfil || {})}
      <div class="erro inteiro" id="perfil-erro"></div>
      <button class="btn btn-ouro btn-bloco inteiro">Salvar</button>
    </form>`, (m) => {
    const f = $('#form-perfil', m);
    ligarCampos(f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = lerCadastro(new FormData(f));
      if (r.erro) return ($('#perfil-erro', m).textContent = r.erro);
      if (!cpfValido(r.dados.cpf)) return ($('#perfil-erro', m).textContent = 'CPF inválido. Confira os 11 números.');
      const dadosPerfil = { ...r.dados, email: usuario.email, criadoEm: perfil?.criadoEm || new Date().toISOString() };
      try { await db.set('clientes', usuario.uid, dadosPerfil); } catch (err) { console.error(err); return ($('#perfil-erro', m).textContent = 'Não foi possível salvar. Tente novamente.'); }
      perfil = { ...dadosPerfil, _uid: usuario.uid };
      atualizarBarraConta(); fecharModal(); depois && depois();
    };
  });
}

// Pede CPF e endereço (necessários para o contrato) a quem criou a conta antes dessa exigência
function abrirDadosContrato(depois) {
  abrirModal('Complete seu cadastro', `
    <p style="color:var(--cinza);font-size:14px;margin-bottom:14px">Para gerar o seu contrato de locação precisamos de todos os seus dados. Eles ficam protegidos na sua conta.</p>
    <form id="form-doc" class="grade-form">
      ${htmlDadosPessoais(perfil || {})}
      ${htmlEndereco(perfil || {})}
      <div class="erro inteiro" id="doc-erro"></div>
      <button class="btn btn-ouro btn-bloco inteiro">Continuar</button>
    </form>`, (m) => {
    const f = $('#form-doc', m);
    ligarCampos(f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = lerCadastro(new FormData(f));
      if (r.erro) return ($('#doc-erro', m).textContent = r.erro);
      if (!cpfValido(r.dados.cpf)) return ($('#doc-erro', m).textContent = 'CPF inválido. Confira os 11 números.');
      const dadosPerfil = { ...r.dados, email: perfil?.email || usuario.email, criadoEm: perfil?.criadoEm || new Date().toISOString() };
      try { await db.set('clientes', usuario.uid, dadosPerfil); } catch (err) { console.error(err); return ($('#doc-erro', m).textContent = 'Não foi possível salvar. Tente novamente.'); }
      perfil = { ...dadosPerfil, _uid: usuario.uid };
      depois && depois();
    };
  });
}

const fmtDataHora = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ST_CANC = { pendente: 'Cancelamento solicitado — aguardando resposta', recusado: 'Pedido de cancelamento recusado', aceito: 'Cancelamento aceito' };

async function abrirMinhas() {
  abrirModal('Minhas reservas', '<div class="vazio">Carregando…</div>');
  try {
    const [sols, res, cancs] = await Promise.all([
      db.query('solicitacoes', 'uid', usuario.uid),
      db.query('reservas', 'clienteUid', usuario.uid),
      db.query('cancelamentos', 'uid', usuario.uid).catch(() => [])
    ]);
    const cancPor = Object.fromEntries(cancs.map((c) => [c.id, c]));
    const itens = [
      ...sols.map((s) => ({ sol: s, solId: s.id, situacao: situacaoSol(s), data: s.data, dias: s.dias, periodo: periodoTxt(s), hora: s.horaEntrada, total: s.total, codigo: s.codigo, st: ST_SOL[situacaoSol(s)] || ST_SOL.aguardando })),
      ...res.map((r) => {
        const total = (+r.valor || 0) + (+r.taxaLimpeza || 0);
        const pago = (r.pagamentos || []).reduce((t, p) => t + +p.valor, 0);
        return { id: r.id, reserva: r, data: r.data, dias: r.dias, periodo: periodoTxt(r), hora: r.horaEntrada, total, pago, st: ST_RES[r.status] || [r.status, ''], prazo: r.prazoCancelamento, status: r.status, canc: cancPor[r.id] };
      })
    ].sort((a, b) => String(b.data).localeCompare(String(a.data)));

    const linhaCancel = (i) => {
      if (!i.id || !['confirmada', 'pendente'].includes(i.status)) return i.canc?.status === 'aceito' ? `<small class="info-canc">${ST_CANC.aceito}</small>` : '';
      if (i.canc) return `<small class="info-canc ${i.canc.status === 'recusado' ? 'neg' : ''}">${ST_CANC[i.canc.status] || ''}</small>`;
      if (!i.prazo) return '';
      if (Date.now() <= i.prazo) return `<div class="info-canc"><small>Você pode cancelar até <b>${fmtDataHora(i.prazo)}</b></small> <button class="btn-link" data-cancelar="${i.id}">Solicitar cancelamento</button></div>`;
      return `<small class="info-canc neg">Prazo de cancelamento encerrado (${DIAS_CANC} dias após o pagamento)</small>`;
    };

    const linhaPagamento = (i) => {
      if (!i.sol) return '';
      if (i.situacao === 'aguardando') return `<div class="info-canc"><small>⏳ Pague e toque em "Já paguei" em <b data-cont="${i.solId}">--:--</b></small> <button class="btn-link" style="color:var(--verde)" data-pagou="${i.solId}">Já paguei</button></div>`;
      if (i.situacao === 'informado') return '<small class="info-canc">✅ Pagamento informado — aguardando a confirmação do Espaço Veja.</small>';
      if (i.situacao === 'expirada') return `<small class="info-canc neg">O pagamento não foi informado em ${+info.prazoPagamentoMin || 30} minutos e a pré-reserva expirou.</small>`;
      return '';
    };
    // reserva confirmada, antes do fim da estadia: pode pedir mais tempo (vai para aprovação)
    const linhaExtensao = (i) => (info.preReserva && i.reserva && i.status === 'confirmada' && i.reserva.data && i.reserva.horaEntrada && Date.now() <= iniFim(i.reserva).fim
      ? `<button class="btn btn-claro btn-peq" style="margin-top:8px;margin-right:6px" data-estender="${i.id}">⏱ Pedir mais tempo</button>` : '');
    const linhaContrato = (i) => {
      if (i.sol?.extensao) return '';
      if (i.reserva && ['confirmada', 'concluida'].includes(i.status) && i.reserva.contrato) return `<button class="btn btn-claro btn-peq" style="margin-top:8px" data-contrato="${i.id}">📄 Baixar contrato</button>`;
      if (i.codigo || i.status === 'pendente') return '<small class="info-canc" style="color:var(--cinza)">📄 O contrato fica disponível após a confirmação do pagamento.</small>';
      return '';
    };
    const corpo = $('#modal-raiz .modal-corpo');
    corpo.innerHTML = itens.length ? `<div class="lista-res">${itens.map((i) => `
      <div class="item-res" style="cursor:default;flex-wrap:wrap">
        <div class="meio"><b>${i.sol?.extensao ? '⏱ Pedido de mais tempo · ' : ''}${i.data ? br(i.data) + ((+i.dias || 1) > 1 ? ` a ${br(addDias(i.data, i.dias - 1))}` : '') : 'Sem data (crédito)'}</b><small>${i.periodo}${i.hora ? ' · ' + entradaSaidaTxt({ data: i.data, dias: i.dias, meia: (i.sol || i.reserva)?.meia, periodo: i.sol?.periodo || i.reserva?.periodo, horaEntrada: i.hora }) : ''}${i.codigo ? ' · ' + esc(i.codigo) : ''}${i.pago != null ? ` · pago ${fmt(i.pago)}` : ''}</small></div>
        <div class="dir"><span class="selo ${i.st[1]}">${i.st[0]}</span><b>${fmt(i.total)}</b></div>
        <div style="flex-basis:100%">${linhaPagamento(i)}${linhaCancel(i)}${linhaExtensao(i)}${i.situacao === 'expirada' || i.situacao === 'recusada' ? '' : linhaContrato(i)}</div>
      </div>`).join('')}</div>` : '<div class="vazio">Você ainda não tem reservas.<br>Escolha um dia livre no calendário!</div>';
    corpo.querySelectorAll('[data-contrato]').forEach((b) => (b.onclick = () => {
      const r = itens.find((i) => i.id === b.dataset.contrato).reserva;
      abrirContrato(htmlContrato(r, r.contrato), `Contrato - ${info.nome} - ${br(r.data)}`);
    }));
    corpo.querySelectorAll('[data-cancelar]').forEach((b) => (b.onclick = () => abrirCancelamento(itens.find((i) => i.id === b.dataset.cancelar))));
    corpo.querySelectorAll('[data-estender]').forEach((b) => (b.onclick = () => abrirExtensao(itens.find((i) => i.id === b.dataset.estender).reserva)));
    limparTimers();
    corpo.querySelectorAll('[data-cont]').forEach((el) => { const i = itens.find((x) => x.solId === el.dataset.cont); contagem(el, i.sol.expiraEm, () => abrirMinhas()); });
    corpo.querySelectorAll('[data-pagou]').forEach((b) => (b.onclick = async () => {
      const i = itens.find((x) => x.solId === b.dataset.pagou);
      const msg = `Olá! Fiz a pré-reserva *${i.codigo}* pelo site para ${br(i.data)} e já paguei o sinal de ${fmt(i.sol.sinal)}. Segue o comprovante.`;
      const janela = info.whatsapp ? window.open(linkZap(msg), '_blank') : null;
      try { await informarPagamento(i.solId, i.sol); } catch (e) { console.error(e); janela?.close(); alert('O prazo terminou. Fale com a gente pelo WhatsApp.'); }
      abrirMinhas();
    }));
  } catch (e) {
    console.error(e);
    $('#modal-raiz .modal-corpo').innerHTML = '<div class="vazio">Não foi possível carregar agora. Tente novamente.</div>';
  }
}

const DIAS_CANC = 7;
function abrirCancelamento(i) {
  abrirModal('Solicitar cancelamento', `
    <p style="margin-bottom:10px">Reserva de <b>${br(i.data)}</b> (${i.periodo}).</p>
    <p class="nota-seg" style="background:var(--laranja-bg);color:#7a4d05;margin-bottom:14px">${CADEADO}<span>O cancelamento só pode ser pedido até <b>${fmtDataHora(i.prazo)}</b> (${DIAS_CANC} dias após a confirmação do pagamento). O pedido é analisado pelo ${esc(info.nome)} e a resposta aparece aqui em Minhas reservas.</span></p>
    <form id="form-canc" class="grade-form">
      <label class="campo inteiro">Motivo (opcional)<textarea name="motivo" maxlength="300" placeholder="Conte o motivo do cancelamento"></textarea></label>
      <div class="erro inteiro" id="canc-erro"></div>
      <div class="modal-acoes inteiro" style="margin-top:0">
        <button type="button" class="btn btn-claro" id="canc-voltar">Voltar</button>
        <button class="btn btn-perigo">Confirmar pedido de cancelamento</button>
      </div>
    </form>`, (m) => {
    $('#canc-voltar', m).onclick = abrirMinhas;
    $('#form-canc', m).onsubmit = async (e) => {
      e.preventDefault();
      if (Date.now() > i.prazo) return ($('#canc-erro', m).textContent = 'O prazo de cancelamento já terminou.');
      const btn = $('button.btn-perigo', m); btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        await db.set('cancelamentos', i.id, {
          uid: usuario.uid, reservaId: i.id, cliente: perfil?.nome || usuario.email, data: i.data,
          motivo: new FormData(e.target).get('motivo').trim().slice(0, 300), status: 'pendente', criadoEm: new Date().toISOString()
        });
        abrirMinhas();
      } catch (err) {
        console.error(err); btn.disabled = false; btn.textContent = 'Tentar novamente';
        $('#canc-erro', m).textContent = 'Não foi possível enviar o pedido. O prazo pode ter terminado; fale com a gente pelo WhatsApp.';
      }
    };
  });
}

// ---------------------------------------------------------------- pré-reserva
function abrirPreReserva(iso, dias = 1) {
  const temPix = !!info.pix?.chave && siteOficial;
  const varias = dias > 1;
  const diaExtra = addDias(iso, dias);               // dia seguinte à última diária (meia diária ocupa a data)
  const extraLivre = !marcados[diaExtra];
  let meia = false;
  const datasAtuais = () => datasDe({ data: iso, dias, meia });
  const fimTxt = varias ? ` a ${br(addDias(iso, dias - 1))}` : '';
  abrirModal(`Reservar · ${br(iso)}${fimTxt}`, `
    <p style="color:var(--cinza);margin-bottom:12px">${varias ? `${dias} diárias seguidas` : diaExtenso(iso)} · ${esc(info.nome)}</p>
    <div class="box-valores" style="margin-bottom:14px;font-size:14px">
      <div class="resumo-linha"><span>Nome</span><b>${esc(perfil.nome)}</b></div>
      <div class="resumo-linha"><span>WhatsApp</span><b>${esc(mascaraFone(perfil.telefone))}</b></div>
      <div class="resumo-linha"><span>CPF</span><b>${esc(mascaraCpf(perfil.cpf))}</b></div>
      <div class="resumo-linha" style="gap:12px"><span>Endereço</span><b style="text-align:right">${esc(perfil.endereco)}</b></div>
      <button type="button" class="btn-link" id="editar-dados" style="font-size:13px;padding:6px 0 0">Corrigir meus dados</button>
    </div>
    <form id="form-pre" class="grade-form">
      <label class="campo inteiro">Tipo de evento *<input name="evento" list="ev" required minlength="3" maxlength="60" placeholder="Ex.: Aniversário, churrasco, confraternização">
        <datalist id="ev"><option>Aniversário</option><option>Confraternização</option><option>Chá de bebê</option><option>Churrasco</option><option>Casamento</option><option>Day use</option><option>Hospedagem / temporada</option></datalist></label>
      ${varias ? `<input type="hidden" name="periodo" value="24h">` : `<div class="campo inteiro">Período *
        <div class="opc-periodo">
          <label><input type="radio" name="periodo" value="24h" checked><span><b>24 horas</b><small>${fmt(info.preco24)}</small></span></label>
          <label><input type="radio" name="periodo" value="12h"><span><b>12 horas</b><small>${fmt(info.preco12)}</small></span></label>
        </div>
      </div>`}
      ${+info.preco12 > 0 ? `<label class="inteiro opc-extra" ${varias ? '' : 'id="opc-meia"'} style="${varias ? '' : 'display:none'}"><input type="checkbox" name="meia" ${extraLivre ? '' : 'disabled'}><span><b>+ Meia diária (12 horas) no final</b><small>${extraLivre ? `+ ${fmt(info.preco12)} · ex.: 3 diárias + 12h = 3 dias e meio` : `Indisponível: o dia ${br(diaExtra)} já está reservado`}</small></span></label>` : ''}
      ${listaHorarios().length > 1 ? `<label class="campo inteiro">Horário de entrada *
        <select name="horaEntrada" required></select>
        <span class="horario-info" id="saida-info"></span><span class="horario-info" id="folga-info"></span></label>` : `<div class="campo inteiro">Horário<input type="hidden" name="horaEntrada" value="${listaHorarios()[0]}">
        <span class="horario-info" id="saida-info" style="font-size:14px"></span></div>`}
      ${+info.taxaLimpeza > 0 ? `<label class="inteiro opc-extra"><input type="checkbox" name="limpeza"><span><b>Quero a limpeza pós-evento</b><small>+ ${fmt(info.taxaLimpeza)} · nossa equipe cuida da limpeza depois da sua festa</small></span></label>` : ''}
      <label class="campo inteiro">Observações (opcional)<textarea name="obs" maxlength="400" placeholder="Ex.: número de convidados, pedidos especiais…"></textarea></label>
      <div class="inteiro box-valores" style="margin:0" id="resumo"></div>
      ${info.regras ? `<div class="inteiro regras"><b>Regras do espaço</b><div>${esc(info.regras).replace(/\n/g, '<br>')}</div></div>
      <label class="inteiro" style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input type="checkbox" name="aceite" required style="margin-top:3px"> Li e concordo com as regras do espaço.</label>` : ''}
      <div class="inteiro regras" style="max-height:none"><b>📄 Contrato de locação</b>Ao reservar você aceita eletronicamente o contrato de locação por temporada, com as regras de uso do espaço, da piscina, dos utensílios e de desistência. <button type="button" class="btn-link" id="ler-contrato" style="padding:0;font-size:13px">Ler o contrato</button></div>
      <label class="inteiro" style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input type="checkbox" name="aceiteContrato" required style="margin-top:3px"> Li e aceito o contrato de locação.</label>
      <div class="erro inteiro" id="pre-erro"></div>
      <div class="modal-acoes inteiro" style="margin-top:0">
        <button type="button" class="btn btn-claro" data-fechar2>Voltar</button>
        <button class="btn btn-ouro" type="submit">${temPix ? 'Continuar para o pagamento' : 'Enviar pré-reserva'}</button>
      </div>
    </form>`, (m) => {
    const f = $('#form-pre', m);
    const periodo = () => (varias ? '24h' : f.querySelector('[name=periodo]:checked').value);
    const opcMeia = $('#opc-meia', m);
    const valores = () => {
      meia = !!f.meia?.checked && periodo() === '24h';
      const valor = (varias ? +info.preco24 * dias : periodo() === '12h' ? +info.preco12 : +info.preco24) + (meia ? +info.preco12 : 0);
      const limpeza = f.limpeza?.checked ? +info.taxaLimpeza : 0;
      const total = valor + limpeza;
      const sinal = Math.round(total * (+info.sinalPct || 100)) / 100;
      return { valor, limpeza, total, sinal };
    };
    const resumo = () => {
      const v = valores();
      $('#resumo', m).innerHTML = `
        <div class="resumo-linha"><span>${varias ? `${dias} diárias × ${fmt(info.preco24)}` : `Locação ${periodo()}`}</span><span>${fmt(v.valor - (meia ? +info.preco12 : 0))}</span></div>
        ${meia ? `<div class="resumo-linha"><span>Meia diária (12h)</span><span>${fmt(+info.preco12)}</span></div>` : ''}
        ${v.limpeza ? `<div class="resumo-linha"><span>Limpeza pós-evento</span><span>${fmt(v.limpeza)}</span></div>` : ''}
        <div class="resumo-linha total"><span>Total</span><span>${fmt(v.total)}</span></div>
        ${temPix && v.sinal < v.total ? `<div class="resumo-linha"><span>Sinal para garantir ${varias ? 'as datas' : 'a data'} (${info.sinalPct}%)</span><b>${fmt(v.sinal)}</b></div>` : ''}`;
    };
    // só oferece horários que respeitam o intervalo de limpeza com as locações vizinhas
    const atualizarHorarios = () => {
      const livres = horariosLivres(iso, { dias, periodo: periodo(), meia });
      if (f.horaEntrada.tagName === 'SELECT') {
        const atual = f.horaEntrada.value || (info.horaEntrada || '').padStart(5, '0');
        f.horaEntrada.innerHTML = livres.map((h) => `<option ${h === atual ? 'selected' : ''}>${h}</option>`).join('');
      }
      const ok = livres.includes(f.horaEntrada.value);
      $('button[type=submit]', f).disabled = !ok;
      $('#pre-erro', m).textContent = ok ? '' : `Não há horário de entrada disponível com essa opção. ${txtFolga()} Tente outro período, sem a meia diária ou outro dia.`;
      const tirados = listaHorarios().length - livres.length;
      if ($('#folga-info', m)) $('#folga-info', m).textContent = ok && tirados ? `Alguns horários não aparecem por causa de outra locação próxima. ${txtFolga()}` : '';
    };
    const atualizarSaida = () => {
      if (opcMeia) { opcMeia.style.display = periodo() === '24h' ? '' : 'none'; }
      if (!f.horaEntrada.value) return ($('#saida-info', m).innerHTML = '');
      const s = saidaDate({ data: iso, dias, meia, periodo: periodo(), horaEntrada: f.horaEntrada.value });
      $('#saida-info', m).innerHTML = `Entrada <b>${brCurto(iso)} às ${f.horaEntrada.value}</b> · saída prevista <b>${String(s.getDate()).padStart(2, '0')}/${String(s.getMonth() + 1).padStart(2, '0')} às ${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}</b>`;
    };
    f.querySelectorAll('[name=periodo], [name=limpeza], [name=meia]').forEach((r) => (r.onchange = () => { resumo(); atualizarHorarios(); atualizarSaida(); }));
    f.horaEntrada.onchange = atualizarSaida;
    resumo(); atualizarHorarios(); atualizarSaida();
    $('[data-fechar2]', m).onclick = fecharModal;
    $('#editar-dados', m).onclick = () => abrirDadosContrato(() => abrirPreReserva(iso, dias));
    const montar = () => {
      const v = valores();
      return { cliente: perfil.nome, clienteCpf: perfil.cpf, clienteEndereco: perfil.endereco, telefone: perfil.telefone, clienteEmail: usuario.email, data: iso, dias, meia, periodo: periodo(), horaEntrada: f.horaEntrada.value, evento: f.evento.value.trim(), valor: v.valor, taxaLimpeza: v.limpeza, total: v.total, sinal: v.sinal };
    };
    $('#ler-contrato', m).onclick = () => abrirContrato(htmlContrato({ ...montar(), pagamentos: [] }, { clausulas: CLAUSULAS_PADRAO, ...(info.contrato || {}), nomeEspaco: info.nome }, { previa: true }), 'Contrato de locação (prévia)');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const datas = datasAtuais();
      const ocupada = datas.find((x) => marcados[x]);
      if (ocupada) return ($('#pre-erro', m).textContent = `O dia ${br(ocupada)} acabou de ser reservado. Escolha outras datas.`);
      const r = montar();
      const codigo = 'VEJA' + Math.random().toString(36).slice(2, 6).toUpperCase();
      const { ini, fim } = iniFim(r);
      const sol = {
        uid: usuario.uid, email: usuario.email,
        cliente: r.cliente.slice(0, 80), telefone: r.telefone, data: iso, dias, ...(r.meia ? { meia: true } : {}), periodo: r.periodo, horaEntrada: r.horaEntrada,
        evento: r.evento.slice(0, 60), obs: (d.obs || '').trim().slice(0, 400),
        valor: r.valor, taxaLimpeza: r.taxaLimpeza, total: r.total, sinal: temPix ? r.sinal : 0,
        codigo, status: 'aguardando', criadoEm: new Date().toISOString(), expiraEm: Date.now() + (+info.prazoPagamentoMin || 30) * 60000, aceitouRegras: !!d.aceite || !info.regras,
        clienteCpf: r.clienteCpf, clienteEndereco: String(r.clienteEndereco || '').slice(0, 150), aceiteContrato: new Date().toISOString(),
        // horário exato e dias vizinhos: as regras conferem o intervalo de limpeza com as locações de antes e de depois
        ini, fim, antes: addDias(iso, -1), depois: addDias(iso, contaDatas(r))
      };
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Enviando…';
      const erro = (msg) => { btn.disabled = false; btn.textContent = 'Tentar novamente'; $('#pre-erro', m).innerHTML = msg; };
      // 1) só uma pré-reserva aguardando por vez
      const pend = await pendenciaAtiva();
      if (pend) return erro(msgPendencia(pend));
      // 2) confere de novo, direto no banco, se as datas e os horários continuam livres (outra pessoa pode ter reservado agora)
      try {
        const atuais = (await Promise.all([sol.antes, ...datas, sol.depois].map((x) => db.get('ocupacao', x)))).filter(Boolean);
        const ocupada = atuais.find((o) => datas.includes(o.id) && ocupacaoValida(o));
        if (ocupada) { marcados[ocupada.id] = ocupada.status; desenhar(); return erro(`O dia ${br(ocupada.id)} acabou de ser reservado por outra pessoa. Escolha outras datas.`); }
        if (choqueHorario(ini, fim, atuais, folgaH())) return erro(`Esse horário ficou colado em outra locação. ${txtFolga()} Atualize a página e escolha outro horário.`);
      } catch (e) { console.warn(e); }
      // 3) cria a pré-reserva
      let solId;
      try { solId = await db.novaSolicitacao(usuario.uid, sol); }
      catch (err) { console.error(err); return erro(/permission|insufficient/i.test(err.code || err.message) ? 'Os valores, os horários ou as regras mudaram enquanto você reservava. Atualize a página (puxe a tela para baixo) e tente de novo.' : 'Não foi possível enviar agora. Tente de novo ou fale pelo WhatsApp.'); }
      // 4) segura as datas; se alguma foi pega por outra pessoa no mesmo instante, desfaz tudo
      if (!(await segurarDatas(solId, sol))) return erro('Outra pessoa acabou de reservar uma dessas datas. Nada foi cobrado — escolha outras datas.');
      selecao = { ini: null, fim: null }; desenhar(); $('#sel').innerHTML = '';
      mostrarConfirmacao(sol, temPix, solId);
    };
  });
}

// Segura no calendário as datas da pré-reserva (ou da extensão). Se outra pessoa pegou uma delas no mesmo instante, desfaz tudo.
async function segurarDatas(solId, sol) {
  const seguradas = [];
  try {
    for (const x of datasMarcadas(sol)) { await db.set('ocupacao', x, { status: 'pendente', expiraEm: sol.expiraEm, sol: solId, ...horario(sol) }); seguradas.push(x); }
  } catch (err) {
    console.warn('conflito de datas', err);
    for (const x of seguradas) await db.set('ocupacao', x, { status: 'pendente', expiraEm: Date.now() - 1000, sol: solId, ...horario(sol) }).catch(() => {});
    await db.update('solicitacoes', solId, { status: 'cancelada' }).catch(() => {});
    return false;
  }
  seguradas.forEach((x) => {
    marcados[x] = 'pendente';
    ocupacoes = ocupacoes.filter((o) => o.id !== x).concat({ id: x, status: 'pendente', expiraEm: sol.expiraEm, sol: solId, ...horario(sol) });
  });
  return true;
}

// ---------------------------------------------------------------- extensão (pedir mais tempo)
// Só para reserva CONFIRMADA, antes do fim da estadia. A data seguinte fica "em negociação" até o dono aprovar.
async function abrirExtensao(r) {
  abrirModal('Pedir mais tempo', '<div class="vazio">Conferindo a agenda…</div>');
  try { ocupacoes = await db.list('ocupacao'); } catch (e) { console.warn(e); }
  const pend = await pendenciaAtiva();
  const temPix = !!info.pix?.chave && siteOficial;
  const { ini: iniR, fim: fimR } = iniFim(r);
  const proprias = datasDe(r);
  const opcoes = [12, 24, 48, 72].map((add) => {
    const nova = formaDeHoras(horasDe(r) + add);
    const valor = precoForma(nova, info) - precoForma(r, info);
    const fim = iniR + horasDe(nova) * 3600e3;
    const novas = datasDe({ data: r.data, ...nova }).filter((d) => !proprias.includes(d));
    const ocupada = novas.find((d) => marcados[d]);
    const choque = choqueHorario(fimR, fim, ocupacoes, folgaH(), proprias);
    return { add, nova, valor, fim, novas, livre: !ocupada && !choque && valor > 0 };
  });
  const nomeAdd = (h) => (h === 12 ? '+ 12 horas' : `+ ${h / 24} diária${h > 24 ? 's' : ''} (${h}h)`);
  const corpo = $('#modal-raiz .modal-corpo');
  if (pend) { corpo.innerHTML = `<p>${msgPendencia(pend)}</p>`; return; }
  if (Date.now() > fimR) { corpo.innerHTML = '<p>Esta locação já terminou. Para voltar, escolha uma nova data no calendário.</p>'; return; }
  corpo.innerHTML = `
    <p style="margin-bottom:6px">Sua reserva: <b>${periodoTxt(r)}</b> · ${entradaSaidaTxt(r)}</p>
    <p style="color:var(--cinza);font-size:14px;margin-bottom:14px">Escolha quanto tempo a mais você quer. O pedido vai para aprovação do ${esc(info.nome)} e, enquanto isso, o horário fica reservado para você.${folgaH() ? ' ' + txtFolga() : ''}</p>
    <form id="form-ext" class="grade-form">
      <div class="inteiro opc-periodo" style="display:grid;gap:8px">${opcoes.map((o, i) => `
        <label style="${o.livre ? '' : 'opacity:.5'}"><input type="radio" name="ext" value="${i}" ${o.livre ? '' : 'disabled'}><span><b>${nomeAdd(o.add)}</b>
          <small>${o.livre ? `${fmt(o.valor)} · nova saída ${fmtDataHora(o.fim)}` : 'Indisponível: já existe outra locação nesse horário'}</small></span></label>`).join('')}
      </div>
      <div class="erro inteiro" id="ext-erro"></div>
      <div class="modal-acoes inteiro" style="margin-top:0">
        <button type="button" class="btn btn-claro" id="ext-voltar">Voltar</button>
        <button class="btn btn-ouro" type="submit">${temPix ? 'Continuar para o pagamento' : 'Enviar pedido'}</button>
      </div>
    </form>`;
  $('#ext-voltar').onclick = abrirMinhas;
  if (!opcoes.some((o) => o.livre)) $('#ext-erro').textContent = 'Não há horário livre logo depois da sua reserva. Fale com a gente pelo WhatsApp.';
  $('#form-ext').onsubmit = async (e) => {
    e.preventDefault();
    const o = opcoes[new FormData(e.target).get('ext')];
    if (!o) return ($('#ext-erro').textContent = 'Escolha uma opção.');
    const btn = $('#form-ext button[type=submit]'); btn.disabled = true; btn.textContent = 'Enviando…';
    const erro = (msg) => { btn.disabled = false; btn.textContent = 'Tentar novamente'; $('#ext-erro').textContent = msg; };
    const sinal = temPix ? Math.round(o.valor * (+info.sinalPct || 100)) / 100 : 0;
    const sol = {
      uid: usuario.uid, email: usuario.email, cliente: (perfil?.nome || r.cliente).slice(0, 80), telefone: perfil?.telefone || r.telefone,
      data: r.data, dias: o.nova.dias, ...(o.nova.meia ? { meia: true } : {}), periodo: o.nova.periodo, horaEntrada: r.horaEntrada,
      evento: String(r.evento || '').slice(0, 60), obs: `Extensão ${nomeAdd(o.add)}`,
      valor: o.valor, taxaLimpeza: 0, total: o.valor, sinal,
      codigo: 'VEJA' + Math.random().toString(36).slice(2, 6).toUpperCase(), status: 'aguardando', criadoEm: new Date().toISOString(),
      expiraEm: Date.now() + (+info.prazoPagamentoMin || 30) * 60000, aceitouRegras: true,
      extensao: r.id, marcaIni: addDias(r.data, contaDatas(r)), ini: fimR, fim: o.fim, depois: addDias(r.data, contaDatas(o.nova))
    };
    let solId;
    try { solId = await db.novaSolicitacao(usuario.uid, sol); }
    catch (err) { console.error(err); return erro('Não foi possível enviar o pedido (o horário pode ter sido reservado agora). Atualize a página ou fale pelo WhatsApp.'); }
    if (!(await segurarDatas(solId, sol))) return erro('Outra pessoa acabou de reservar esse horário. Nada foi cobrado.');
    desenhar();
    mostrarConfirmacao(sol, temPix, solId);
  };
}

function mostrarConfirmacao(sol, temPix, solId) {
  const ext = !!sol.extensao;
  const msgZap = (ext
    ? `Olá! Pedi pelo site mais tempo na minha reserva de ${br(sol.data)} (pedido *${sol.codigo}*: ${sol.obs.replace('Extensão ', '')}, nova saída ${fmtDataHora(sol.fim)}) em nome de ${sol.cliente}.`
    : `Olá! Fiz a pré-reserva *${sol.codigo}* pelo site para ${(+sol.dias || 1) > 1 ? `${br(sol.data)} a ${br(addDias(sol.data, sol.dias - 1))} (${sol.dias} diárias` : `o dia ${br(sol.data)} (${sol.periodo}`}, ${entradaSaidaTxt(sol)}) em nome de ${sol.cliente}.`)
    + (temPix ? ` Segue o comprovante do Pix de ${fmt(sol.sinal)}.` : ' Aguardo a confirmação!');
  let pixHtml = '';
  if (temPix) {
    const copiaECola = gerarPix({ ...info.pix, valor: sol.sinal, txid: sol.codigo });
    pixHtml = `
      <div class="pix-box">
        <b>Pague ${fmt(sol.sinal)} via Pix para garantir a data</b>
        <div class="pix-qr">${qrSVG(copiaECola, 210)}</div>
        <small>Abra o app do seu banco › Pix › Ler QR Code<br>ou use o Pix copia e cola:</small>
        <div class="link-box" style="margin-top:8px"><code id="pix-code">${esc(copiaECola)}</code><button class="btn btn-ouro btn-peq" id="pix-copiar">Copiar</button></div>
        <div class="nota-seg" style="margin-top:12px;text-align:left">${CADEADO}<span>Antes de confirmar no banco, confira se o recebedor é <b>${esc(info.pix.nome)}</b>. Se aparecer outro nome, não pague.</span></div>
      </div>`;
  }
  abrirModal(ext ? 'Pedido de mais tempo enviado! ⏱' : 'Pré-reserva enviada! 🎉', `
    <div style="text-align:center">
      <p style="margin-bottom:6px">${ext ? 'Código do pedido' : 'Código da sua reserva'}: <b style="color:var(--ouro-esc);font-size:18px">${esc(sol.codigo)}</b></p>
      <p style="color:var(--cinza);font-size:14px;margin-bottom:16px">${ext ? `${esc(sol.obs)} · reserva passa a ser ${periodoTxt(sol)} · ${entradaSaidaTxt(sol)} · a pagar ${fmt(sol.total)}` : `${(+sol.dias || 1) > 1 ? `${br(sol.data)} a ${br(addDias(sol.data, sol.dias - 1))}` : diaExtenso(sol.data)} · ${periodoTxt(sol)} · ${entradaSaidaTxt(sol)} · total ${fmt(sol.total)}`}</p>
      ${pixHtml}
      <div class="prazo-pag" id="prazo-box">⏳ Você tem <b id="prazo-tempo">--:--</b> para pagar e tocar em <b>Já paguei</b>. Depois disso a pré-reserva é cancelada automaticamente e ${(+sol.dias || 1) > 1 ? 'as datas voltam' : 'a data volta'} a ficar livre.</div>
      <button class="btn btn-verde btn-bloco" id="ja-paguei" style="margin-top:12px">${ZAP} Já paguei — enviar comprovante</button>
      <p style="color:var(--cinza);font-size:13px;margin-top:12px">Depois de tocar em "Já paguei", ${(+sol.dias || 1) > 1 ? 'as datas ficam seguradas' : 'a data fica segurada'} até confirmarmos o pagamento. Acompanhe em <b>Minhas reservas</b>.</p>
    </div>`, (m) => {
    limparTimers();
    contagem($('#prazo-tempo', m), sol.expiraEm, () => {
      if ($('#ja-paguei', m)?.disabled) return;
      $('#prazo-box', m).innerHTML = '⌛ <b>Tempo esgotado.</b> A pré-reserva foi cancelada. Escolha a data novamente no calendário.';
      $('#prazo-box', m).classList.add('esgotado'); $('#ja-paguei', m).remove();
      datasMarcadas(sol).forEach((d) => delete marcados[d]); desenhar();
    });
    $('#ja-paguei', m).onclick = async (e) => {
      const btn = e.currentTarget;
      const janela = info.whatsapp ? window.open(linkZap(msgZap), '_blank') : null;
      btn.disabled = true; btn.textContent = 'Registrando…';
      try {
        await informarPagamento(solId, sol);
        limparTimers();
        $('#prazo-box', m).innerHTML = '✅ <b>Pagamento informado!</b> Agora é só aguardar a nossa confirmação. Se o WhatsApp não abriu, envie o comprovante para o nosso número.';
        $('#prazo-box', m).classList.add('ok');
        btn.innerHTML = `${ZAP} Abrir WhatsApp de novo`; btn.disabled = false;
        btn.onclick = () => info.whatsapp && window.open(linkZap(msgZap), '_blank');
      } catch (err) {
        console.error(err); janela?.close();
        btn.disabled = false; btn.innerHTML = `${ZAP} Já paguei — enviar comprovante`;
        $('#prazo-box', m).innerHTML = '⚠️ O prazo terminou ou houve um erro. Fale com a gente pelo WhatsApp.';
      }
    };
    $('#pix-copiar', m)?.addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText($('#pix-code', m).textContent); e.target.textContent = 'Copiado ✓'; }
      catch { const r = document.createRange(); r.selectNode($('#pix-code', m)); getSelection().removeAllRanges(); getSelection().addRange(r); }
    });
  });
}

// ---------------------------------------------------------------- início
async function carregarApp(tentativa = 1) {
  try {
    const [pub, ocup] = await Promise.all([db.get('publico', 'info'), db.list('ocupacao')]);
    if (pub) info = { ...info, ...pub };
    else if (db.modoDemo) { const cfg = await db.get('config', 'geral'); if (cfg) info = { ...info, ...cfg, whatsapp: cfg.whatsapp ? '55' + cfg.whatsapp.replace(/^55/, '') : '' }; }
    ocupacoes = ocup;
    marcados = Object.fromEntries(ocup.filter((o) => ocupacaoValida(o)).map((o) => [o.id, o.status || 'reservado']));
    $('#pub-nome').textContent = info.nome;
    document.title = `Datas disponíveis · ${info.nome}`;
    $('.pub-dica').textContent = info.preReserva ? 'Toque em um dia livre para reservar.' : 'Toque em um dia livre para pedir a reserva pelo WhatsApp.';
  } catch (e) {
    console.error(e);
    // login guardado de antes da confirmação do e-mail: renova o acesso e tenta de novo
    if (tentativa === 1 && !db.modoDemo) {
      const ok = await db.clienteVerificarEmail().catch(() => true);
      if (!ok) { usuario.emailVerified = false; return rotear(); }
      return carregarApp(2);
    }
    $('#cal').innerHTML = `<div class="vazio">Não foi possível carregar as datas agora (${esc(e.code || 'erro')}).<br><br><button class="btn btn-ouro btn-peq" id="cal-tentar">Tentar de novo</button> <button class="btn btn-claro btn-peq" id="cal-sair">Sair da conta</button></div>`;
    $('#cal-tentar').onclick = () => location.reload();
    $('#cal-sair').onclick = async () => { await db.clienteSair(); location.reload(); };
    return;
  }
  montarSelo('#selo');
  carregarFotos();
  $('#ant').onclick = () => { mes = new Date(mes.getFullYear(), mes.getMonth() - 1, 1); desenhar(); };
  $('#prox').onclick = () => { mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1); desenhar(); };
  desenhar();
}

let appCarregado = false;
function mostrarAcesso(abrir) {
  fecharModal();
  $('#app-cliente').classList.add('oculto');
  $('#tela-acesso').classList.remove('oculto');
  abrir();
}
async function entrarNoSistema() {
  $('#tela-acesso').classList.add('oculto');
  $('#app-cliente').classList.remove('oculto');
  atualizarBarraConta();
  if (!appCarregado) { appCarregado = true; await carregarApp(); }
}
async function rotear() {
  if (!usuario) return mostrarAcesso(() => abrirConta('entrar', entrarNoSistema));
  if (!usuario.emailVerified) return mostrarAcesso(() => abrirConfirmarEmail(entrarNoSistema));
  if (!perfil && !db.modoDemo) {
    // conta excluída/bloqueada pelo dono: o banco recusa a leitura
    try { await db.get('publico', 'info'); } catch (e) { return mostrarAcesso(contaDesativada); }
  }
  if (!perfil) return mostrarAcesso(() => abrirCompletarPerfil(entrarNoSistema));
  entrarNoSistema();
}

function contaDesativada() {
  abrirAcesso('Conta desativada', `
    <p class="acesso-sub">Esta conta foi desativada pelo ${esc(info.nome)}. Se achar que é um engano, fale com a gente pelo WhatsApp.</p>
    <button class="btn btn-claro btn-bloco" id="sair-desativada">Sair</button>`, (m) => {
    $('#sair-desativada', m).onclick = () => db.clienteSair();
  });
}

async function iniciar() {
  montarAlertaFalso();
  montarSelo('#selo-acesso');
  if (!siteOficial) {
    $('#acesso-corpo').innerHTML = `<div class="vazio" style="color:var(--vermelho)">Este endereço não é o site oficial.<br>Acesse <b>${esc(db.dominioOficial)}</b>.</div>`;
    return;
  }
  await db.clienteOnAuth(async (u) => {
    if (u && usuario?.uid === u.uid) u.emailVerified = u.emailVerified || usuario.emailVerified;
    usuario = u;
    await carregarPerfil();
    rotear();
  });
}
iniciar();
