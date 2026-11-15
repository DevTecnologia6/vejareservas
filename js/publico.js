// =====================================================================
//  Calendário público — datas livres, conta do cliente, pré-reserva e Pix
// =====================================================================
import * as db from './db.js';
import { renderCalendario, MESES } from './calendar.js';
import { gerarPix, qrSVG } from './pix.js';
import { abrirVisualizador } from './fotos.js';

const $ = (s, el = document) => el.querySelector(s);
const br = (iso) => iso.split('-').reverse().join('/');
const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const foneFmt = (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d; };
const ZAP = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>';
const CADEADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ST_SOL = { aguardando: ['Aguardando confirmação', 'st-pendente'], recusada: ['Não aprovada', 'st-cancelada'] };
const ST_RES = { pendente: ['Pendente', 'st-pendente'], confirmada: ['Confirmada', 'st-confirmada'], congelada: ['Congelada (crédito)', 'st-congelada'], concluida: ['Concluída', 'st-concluida'], cancelada: ['Cancelada', 'st-cancelada'] };

let mes = new Date(); mes.setDate(1);
let marcados = {};
let info = { nome: 'Espaço Veja', whatsapp: '', preco12: 770, preco24: 1000, taxaLimpeza: 75, horaEntrada: '09:00', horarios: '08:00, 09:00, 10:00, 12:00, 14:00', sinalPct: 50, preReserva: true, regras: '', pix: null };
let usuario = null;   // { uid, email, emailVerified }
let perfil = null;    // { nome, telefone }
let fotos = [];

const listaHorarios = () => String(info.horarios || info.horaEntrada || '09:00').split(/[,;\s]+/).filter((h) => /^\d{1,2}:\d{2}$/.test(h)).map((h) => h.padStart(5, '0'));
function saidaPrevista(iso, hora, periodo) {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date(`${iso}T00:00:00`); d.setHours(h + (periodo === '12h' ? 12 : 24), m);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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
}

function selecionar(iso, estado) {
  document.querySelectorAll('.cal-dia.sel').forEach((b) => b.classList.remove('sel'));
  const sel = $('#sel');
  if (estado !== 'livre') {
    sel.innerHTML = `<b>${br(iso)}</b><span style="color:var(--cinza)">Esta data já está ${estado === 'pendente' ? 'em negociação' : 'reservada'}. Escolha outro dia 😉</span>`;
    return;
  }
  document.querySelector(`.cal-dia[data-iso="${iso}"]`)?.classList.add('sel');
  const botoes = [];
  if (info.preReserva && siteOficial) botoes.push(`<button class="btn btn-ouro" id="btn-reservar">Reservar agora</button>`);
  if (info.whatsapp) botoes.push(`<a class="btn ${info.preReserva ? 'btn-claro' : 'btn-verde'}" target="_blank" rel="noopener" href="${linkZap(`Olá! Vi no calendário que o ${info.nome} está livre no dia ${br(iso)} (${diaExtenso(iso).toLowerCase()}). Gostaria de mais informações para reservar!`)}">${ZAP} Conversar no WhatsApp</a>`);
  sel.innerHTML = `<b>${diaExtenso(iso)} está livre!</b>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${botoes.join('') || '<span style="color:var(--cinza)">Entre em contato para reservar.</span>'}</div>`;
  $('#btn-reservar')?.addEventListener('click', () => abrirPreReserva(iso));
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
const fecharModal = () => ($('#modal-raiz').innerHTML = '');

// ---------------------------------------------------------------- tela de acesso (obrigatória)
function abrirAcesso(titulo, corpo, aoMontar) {
  const alvo = $('#acesso-corpo');
  alvo.innerHTML = `<h2 class="acesso-titulo">${titulo}</h2>${corpo}`;
  aoMontar && aoMontar(alvo);
}

// ---------------------------------------------------------------- conta do cliente
const ERROS = {
  'auth/email-already-in-use': 'Este e-mail já tem conta. Use "Entrar".',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  'auth/unauthorized-domain': 'Este endereço não está autorizado. Use o site oficial.'
};
const msgErro = (e) => ERROS[e?.code] || 'Algo deu errado. Tente novamente.';

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
  $('#btn-sair-cli').onclick = async () => { await db.clienteSair(); };
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
      ${cad ? `<label class="campo inteiro">Nome completo<input name="nome" required minlength="3" maxlength="80" autocomplete="name"></label>
      <label class="campo inteiro">WhatsApp (com DDD)<input name="telefone" required inputmode="tel" placeholder="(27) 99999-9999" autocomplete="tel"></label>` : ''}
      <label class="campo inteiro">E-mail<input type="email" name="email" required autocomplete="email"></label>
      <label class="campo ${cad ? '' : 'inteiro'}">Senha<input type="password" name="senha" required minlength="6" autocomplete="${cad ? 'new-password' : 'current-password'}"></label>
      ${cad ? `<label class="campo">Confirmar senha<input type="password" name="senha2" required minlength="6" autocomplete="new-password"></label>` : ''}
      <div class="erro inteiro" id="conta-erro"></div>
      <button class="btn btn-ouro btn-bloco inteiro" type="submit">${cad ? 'Criar conta' : 'Entrar'}</button>
      ${cad ? `<p class="inteiro nota-seg">${CADEADO} Vamos enviar um link de confirmação para o seu e-mail. Sua senha é criptografada e nunca fica visível para ninguém.</p>`
            : `<button type="button" class="btn-link inteiro" id="esqueci">Esqueci minha senha</button>`}
    </form>`, (m) => {
    m.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => abrirConta(b.dataset.aba, depois)));
    const f = $('#form-conta', m);
    $('#esqueci', m)?.addEventListener('click', async () => {
      if (!f.email.value) return ($('#conta-erro', m).textContent = 'Digite seu e-mail acima primeiro.');
      try { await db.recuperarSenha(f.email.value.trim()); $('#conta-erro', m).innerHTML = '<span style="color:var(--verde)">Enviamos um link para redefinir sua senha. Confira seu e-mail (e o spam).</span>'; }
      catch (e) { $('#conta-erro', m).textContent = msgErro(e); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const erro = $('#conta-erro', m);
      if (cad) {
        const tel = d.telefone.replace(/\D/g, '');
        if (tel.length < 10 || tel.length > 11) return (erro.textContent = 'Informe um WhatsApp válido com DDD.');
        if (d.senha !== d.senha2) return (erro.textContent = 'As senhas não conferem.');
      }
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Aguarde…';
      try {
        if (cad) {
          usuario = await db.clienteCadastrar(d.email.trim(), d.senha);
          const dadosPerfil = { nome: d.nome.trim(), telefone: d.telefone.replace(/\D/g, ''), email: d.email.trim(), criadoEm: new Date().toISOString() };
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
    <form id="form-perfil" class="grade-form">
      <label class="campo inteiro">Nome completo<input name="nome" required minlength="3" maxlength="80"></label>
      <label class="campo inteiro">WhatsApp (com DDD)<input name="telefone" required inputmode="tel" placeholder="(27) 99999-9999"></label>
      <button class="btn btn-ouro btn-bloco inteiro">Salvar</button>
    </form>`, (m) => {
    $('#form-perfil', m).onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      const dadosPerfil = { nome: d.nome.trim(), telefone: d.telefone.replace(/\D/g, ''), email: usuario.email, criadoEm: new Date().toISOString() };
      perfil = { ...dadosPerfil, _uid: usuario.uid };
      await db.set('clientes', usuario.uid, dadosPerfil);
      atualizarBarraConta(); fecharModal(); depois && depois();
    };
  });
}

async function abrirMinhas() {
  abrirModal('Minhas reservas', '<div class="vazio">Carregando…</div>');
  try {
    const [sols, res] = await Promise.all([db.query('solicitacoes', 'uid', usuario.uid), db.query('reservas', 'clienteUid', usuario.uid)]);
    const itens = [
      ...sols.map((s) => ({ data: s.data, periodo: s.periodo, hora: s.horaEntrada, total: s.total, codigo: s.codigo, st: ST_SOL[s.status || 'aguardando'] })),
      ...res.map((r) => {
        const total = (+r.valor || 0) + (+r.taxaLimpeza || 0);
        const pago = (r.pagamentos || []).reduce((t, p) => t + +p.valor, 0);
        return { data: r.data, periodo: r.periodo, hora: r.horaEntrada, total, pago, st: ST_RES[r.status] || [r.status, ''] };
      })
    ].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    $('#modal-raiz .modal-corpo').innerHTML = itens.length ? `<div class="lista-res">${itens.map((i) => `
      <div class="item-res" style="cursor:default">
        <div class="meio"><b>${i.data ? br(i.data) : 'Sem data (crédito)'}</b><small>${i.periodo}${i.hora ? ' · entrada ' + i.hora : ''}${i.codigo ? ' · ' + esc(i.codigo) : ''}${i.pago != null ? ` · pago ${fmt(i.pago)}` : ''}</small></div>
        <div class="dir"><span class="selo ${i.st[1]}">${i.st[0]}</span><b>${fmt(i.total)}</b></div>
      </div>`).join('')}</div>` : '<div class="vazio">Você ainda não tem reservas.<br>Escolha um dia livre no calendário!</div>';
  } catch (e) {
    console.error(e);
    $('#modal-raiz .modal-corpo').innerHTML = '<div class="vazio">Não foi possível carregar agora. Tente novamente.</div>';
  }
}

// ---------------------------------------------------------------- pré-reserva
function abrirPreReserva(iso) {
  const temPix = !!info.pix?.chave && siteOficial;
  abrirModal(`Reservar · ${br(iso)}`, `
    <p style="color:var(--cinza);margin-bottom:16px">${diaExtenso(iso)} · ${esc(info.nome)}</p>
    <form id="form-pre" class="grade-form">
      <label class="campo inteiro">Nome<input name="cliente" required minlength="3" maxlength="80" value="${esc(perfil.nome)}"></label>
      <label class="campo">WhatsApp<input name="telefone" required inputmode="tel" value="${esc(foneFmt(perfil.telefone))}"></label>
      <label class="campo">Tipo de evento<input name="evento" list="ev" maxlength="60" placeholder="Aniversário, churrasco…">
        <datalist id="ev"><option>Aniversário</option><option>Confraternização</option><option>Chá de bebê</option><option>Churrasco</option><option>Day use</option></datalist></label>
      <div class="campo inteiro">Período
        <div class="opc-periodo">
          <label><input type="radio" name="periodo" value="24h" checked><span><b>24 horas</b><small>${fmt(info.preco24)}</small></span></label>
          <label><input type="radio" name="periodo" value="12h"><span><b>12 horas</b><small>${fmt(info.preco12)}</small></span></label>
        </div>
      </div>
      <label class="campo inteiro">Horário de entrada
        <select name="horaEntrada">${listaHorarios().map((h) => `<option ${h === (info.horaEntrada || '').padStart(5, '0') ? 'selected' : ''}>${h}</option>`).join('')}</select>
        <span class="horario-info" id="saida-info"></span></label>
      ${+info.taxaLimpeza > 0 ? `<label class="inteiro opc-extra"><input type="checkbox" name="limpeza"><span><b>Quero a limpeza pós-evento</b><small>+ ${fmt(info.taxaLimpeza)} · nossa equipe cuida da limpeza depois da sua festa</small></span></label>` : ''}
      <label class="campo inteiro">Observações (opcional)<textarea name="obs" maxlength="400" placeholder="Número de convidados, horário que pretende chegar…"></textarea></label>
      <div class="inteiro box-valores" style="margin:0" id="resumo"></div>
      ${info.regras ? `<div class="inteiro regras"><b>Regras do espaço</b><div>${esc(info.regras).replace(/\n/g, '<br>')}</div></div>
      <label class="inteiro" style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input type="checkbox" name="aceite" required style="margin-top:3px"> Li e concordo com as regras do espaço.</label>` : ''}
      <div class="erro inteiro" id="pre-erro"></div>
      <div class="modal-acoes inteiro" style="margin-top:0">
        <button type="button" class="btn btn-claro" data-fechar2>Voltar</button>
        <button class="btn btn-ouro" type="submit">${temPix ? 'Continuar para o pagamento' : 'Enviar pré-reserva'}</button>
      </div>
    </form>`, (m) => {
    const f = $('#form-pre', m);
    const valores = () => {
      const valor = f.periodo.value === '12h' ? +info.preco12 : +info.preco24;
      const limpeza = f.limpeza?.checked ? +info.taxaLimpeza : 0;
      const total = valor + limpeza;
      const sinal = Math.round(total * (+info.sinalPct || 100)) / 100;
      return { valor, limpeza, total, sinal };
    };
    const resumo = () => {
      const v = valores();
      $('#resumo', m).innerHTML = `
        <div class="resumo-linha"><span>Locação ${f.periodo.value}</span><span>${fmt(v.valor)}</span></div>
        ${v.limpeza ? `<div class="resumo-linha"><span>Limpeza pós-evento</span><span>${fmt(v.limpeza)}</span></div>` : ''}
        <div class="resumo-linha total"><span>Total</span><span>${fmt(v.total)}</span></div>
        ${temPix && v.sinal < v.total ? `<div class="resumo-linha"><span>Sinal para garantir a data (${info.sinalPct}%)</span><b>${fmt(v.sinal)}</b></div>` : ''}`;
    };
    const atualizarSaida = () => ($('#saida-info', m).innerHTML = `Entrada ${br(iso).slice(0, 5)} às <b>${f.horaEntrada.value}</b> · saída prevista <b>${saidaPrevista(iso, f.horaEntrada.value, f.periodo.value)}</b>`);
    f.querySelectorAll('[name=periodo], [name=limpeza], [name=horaEntrada]').forEach((r) => (r.onchange = () => { resumo(); atualizarSaida(); }));
    resumo(); atualizarSaida();
    $('[data-fechar2]', m).onclick = fecharModal;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const tel = d.telefone.replace(/\D/g, '');
      if (tel.length < 10 || tel.length > 11) return ($('#pre-erro', m).textContent = 'Informe um WhatsApp válido com DDD.');
      if (marcados[iso]) return ($('#pre-erro', m).textContent = 'Essa data acabou de ser reservada. Escolha outro dia.');
      const v = valores();
      const codigo = 'VEJA' + Math.random().toString(36).slice(2, 6).toUpperCase();
      const sol = {
        uid: usuario.uid, email: usuario.email,
        cliente: d.cliente.trim().slice(0, 80), telefone: tel, data: iso, periodo: d.periodo, horaEntrada: d.horaEntrada,
        evento: (d.evento || '').trim().slice(0, 60), obs: (d.obs || '').trim().slice(0, 400),
        valor: v.valor, taxaLimpeza: v.limpeza, total: v.total, sinal: temPix ? v.sinal : 0,
        codigo, status: 'aguardando', criadoEm: new Date().toISOString(), aceitouRegras: !!d.aceite || !info.regras
      };
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        await db.add('solicitacoes', sol);
        try { await db.set('ocupacao', iso, { status: 'pendente' }); } catch { /* já marcada */ }
        marcados[iso] = 'pendente'; desenhar(); $('#sel').innerHTML = '';
        mostrarConfirmacao(sol, temPix);
      } catch (err) {
        console.error(err); btn.disabled = false; btn.textContent = 'Tentar novamente';
        $('#pre-erro', m).textContent = 'Não foi possível enviar agora. Tente de novo ou fale pelo WhatsApp.';
      }
    };
  });
}

function mostrarConfirmacao(sol, temPix) {
  const msgZap = `Olá! Fiz a pré-reserva *${sol.codigo}* pelo site para o dia ${br(sol.data)} (${sol.periodo}, entrada às ${sol.horaEntrada}) em nome de ${sol.cliente}.` + (temPix ? ` Segue o comprovante do Pix de ${fmt(sol.sinal)}.` : ' Aguardo a confirmação!');
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
  abrirModal('Pré-reserva enviada! 🎉', `
    <div style="text-align:center">
      <p style="margin-bottom:6px">Código da sua reserva: <b style="color:var(--ouro-esc);font-size:18px">${sol.codigo}</b></p>
      <p style="color:var(--cinza);font-size:14px;margin-bottom:16px">${diaExtenso(sol.data)} · ${sol.periodo} · entrada ${sol.horaEntrada} · total ${fmt(sol.total)}</p>
      ${pixHtml}
      <p style="color:var(--cinza);font-size:14px;margin:16px 0">${temPix ? 'Depois de pagar, envie o comprovante pelo WhatsApp. A data fica <b>em negociação</b> até a confirmação do pagamento. Acompanhe em <b>Minhas reservas</b>.' : 'Sua data ficou <b>em negociação</b>. Em breve entraremos em contato pelo WhatsApp para confirmar.'}</p>
      ${info.whatsapp ? `<a class="btn btn-verde btn-bloco" target="_blank" rel="noopener" href="${linkZap(msgZap)}">${ZAP} ${temPix ? 'Enviar comprovante no WhatsApp' : 'Falar no WhatsApp'}</a>` : ''}
    </div>`, (m) => {
    $('#pix-copiar', m)?.addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText($('#pix-code', m).textContent); e.target.textContent = 'Copiado ✓'; }
      catch { const r = document.createRange(); r.selectNode($('#pix-code', m)); getSelection().removeAllRanges(); getSelection().addRange(r); }
    });
  });
}

// ---------------------------------------------------------------- início
async function carregarApp() {
  try {
    const [pub, ocup] = await Promise.all([db.get('publico', 'info'), db.list('ocupacao')]);
    if (pub) info = { ...info, ...pub };
    else if (db.modoDemo) { const cfg = await db.get('config', 'geral'); if (cfg) info = { ...info, ...cfg, whatsapp: cfg.whatsapp ? '55' + cfg.whatsapp.replace(/^55/, '') : '' }; }
    marcados = Object.fromEntries(ocup.map((o) => [o.id, o.status || 'reservado']));
    $('#pub-nome').textContent = info.nome;
    document.title = `Datas disponíveis · ${info.nome}`;
    $('.pub-dica').textContent = info.preReserva ? 'Toque em um dia livre para reservar.' : 'Toque em um dia livre para pedir a reserva pelo WhatsApp.';
  } catch (e) {
    console.error(e);
    $('#cal').innerHTML = '<div class="vazio">Não foi possível carregar as datas agora. Saia e entre novamente na sua conta ou tente em instantes.</div>';
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
function rotear() {
  if (!usuario) return mostrarAcesso(() => abrirConta('entrar', entrarNoSistema));
  if (!usuario.emailVerified) return mostrarAcesso(() => abrirConfirmarEmail(entrarNoSistema));
  if (!perfil) return mostrarAcesso(() => abrirCompletarPerfil(entrarNoSistema));
  entrarNoSistema();
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
