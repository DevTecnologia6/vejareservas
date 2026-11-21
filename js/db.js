// =====================================================================
//  VejaReservas — camada de dados
//  Usa o Firebase (Firestore + Auth) quando configurado; caso contrário
//  usa o localStorage do navegador (modo demonstração).
// =====================================================================
import { firebaseConfig } from './firebase-config.js';
export { dominioOficial, dominiosPermitidos } from './firebase-config.js';

const FB_VERSION = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;

export const modoDemo = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('COLE_AQUI');

let fs, au, fdb, fauth;

async function initFirebase() {
  if (fdb) return;
  const appMod = await import(`${CDN}/firebase-app.js`);
  fs = await import(`${CDN}/firebase-firestore.js`);
  au = await import(`${CDN}/firebase-auth.js`);
  const app = appMod.initializeApp(firebaseConfig);
  fdb = fs.getFirestore(app);
  fauth = au.getAuth(app);
}

// ---------------------------------------------------------------- demo
const LS = 'vejareservas_demo_';
const lsGet = (col) => { try { return JSON.parse(localStorage.getItem(LS + col)) || {}; } catch { return {}; } };
const lsSet = (col, data) => localStorage.setItem(LS + col, JSON.stringify(data));
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const demoListeners = new Set();

// ---------------------------------------------------------------- auth
export async function onAuth(cb) {
  if (modoDemo) {
    const u = localStorage.getItem(LS + 'sessao');
    demoListeners.add(cb);
    cb(u ? { email: u, emailVerified: true } : null);
    return;
  }
  await initFirebase();
  au.onAuthStateChanged(fauth, (u) => cb(u ? { email: u.email, uid: u.uid, emailVerified: u.emailVerified } : null));
}

export async function login(email, senha) {
  if (modoDemo) {
    localStorage.setItem(LS + 'sessao', email || 'demo@vejareservas');
    demoListeners.forEach((cb) => cb({ email, emailVerified: true }));
    return;
  }
  await initFirebase();
  await au.signInWithEmailAndPassword(fauth, email, senha);
}

// ---------------------------------------------------------------- acesso do admin por LINK no e-mail
const CHAVE_LINK = 'vejareservas_email_link';
export async function enviarLinkAcesso(email) {
  localStorage.setItem(CHAVE_LINK, email);
  if (modoDemo) return;
  await initFirebase();
  au.useDeviceLanguage(fauth);
  await au.sendSignInLinkToEmail(fauth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
}
export async function ehLinkDeAcesso() {
  if (modoDemo) return false;
  await initFirebase();
  return au.isSignInWithEmailLink(fauth, location.href);
}
export const emailDoLink = () => localStorage.getItem(CHAVE_LINK) || '';
// aceita o link colado (ex.: atalho na tela inicial, que não compartilha o login com o navegador)
export function linkColado(txt) {
  let t = String(txt || '').trim();
  for (let i = 0; i < 4 && !/oobCode=/.test(t) && /oobCode%3D/i.test(t); i++) { try { t = decodeURIComponent(t); } catch { break; } }
  const code = (t.match(/oobCode=([^&#\s]+)/) || [])[1], key = (t.match(/apiKey=([^&#\s]+)/) || [])[1];
  if (!code || !/mode=signIn/.test(t)) return '';
  return `${location.origin}${location.pathname}?apiKey=${key || firebaseConfig.apiKey}&oobCode=${code}&mode=signIn&lang=pt-BR`;
}
export async function concluirLinkAcesso(email, link = location.href) {
  await initFirebase();
  await au.signInWithEmailLink(fauth, email, link);
  localStorage.removeItem(CHAVE_LINK);
  history.replaceState(null, '', location.pathname);
}
// ---------------------------------------------------------------- 2ª etapa: senha do painel (conferida pelo servidor)
const sha256 = async (txt) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sessaoAtual() {
  const r = await fauth.currentUser.getIdTokenResult(true);
  const at = parseInt(r.claims.auth_time, 10);
  return { uid: fauth.currentUser.uid, at, id: `${fauth.currentUser.uid}_${at}` };
}
// libera ESTE aparelho/sessão com a senha do painel
export async function desbloquearPainel(senha) {
  if (modoDemo) return;
  await initFirebase();
  const s = await sessaoAtual();
  const h = await sha256(`${s.uid}:${senha}`);
  await fs.setDoc(fs.doc(fdb, 'acessoAdmin', s.id), { authTime: s.at, h, em: new Date().toISOString() });
}
// primeiro acesso: cria a senha do painel e troca a senha de login do Firebase por uma aleatória (só se entra pelo link do e-mail)
export async function criarSenhaPainel(senha) {
  if (modoDemo) return;
  await initFirebase();
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  await au.updatePassword(fauth.currentUser, btoa(String.fromCharCode(...bytes)) + 'Aa1!');
  const s = await sessaoAtual();
  const h = await sha256(`${s.uid}:${senha}`);
  await fs.setDoc(fs.doc(fdb, 'segredoAdmin', s.uid), { hash: await sha256(h) });
  await desbloquearPainel(senha);
}
export async function trocarSenhaPainel(nova) {
  if (modoDemo) return;
  const s = await sessaoAtual();
  const h = await sha256(`${s.uid}:${nova}`);
  await fs.setDoc(fs.doc(fdb, 'segredoAdmin', s.uid), { hash: await sha256(h) });
  await desbloquearPainel(nova);
}
// "Sair": tranca o painel neste aparelho (continua autorizado; volta pedindo só a senha)
export async function trancarPainel() {
  if (modoDemo) return logout();
  const s = await sessaoAtual();
  await fs.deleteDoc(fs.doc(fdb, 'acessoAdmin', s.id)).catch(() => {});
}

export async function recuperarSenha(email) {
  if (modoDemo) return;
  await initFirebase();
  au.useDeviceLanguage(fauth);
  await au.sendPasswordResetEmail(fauth, email);
}

export async function logout() {
  if (modoDemo) {
    localStorage.removeItem(LS + 'sessao');
    demoListeners.forEach((cb) => cb(null));
    return;
  }
  await au.signOut(fauth);
}

// ---------------------------------------------------------------- contas de CLIENTE
// (no Firebase é o mesmo Authentication; no modo demo usa uma sessão separada)
const demoUsuarios = () => { try { return JSON.parse(localStorage.getItem(LS + 'usuarios')) || {}; } catch { return {}; } };
const clienteListeners = new Set();
const demoSessaoCliente = () => { const e = localStorage.getItem(LS + 'sessao_cliente'); const u = e && demoUsuarios()[e]; return u ? { uid: u.uid, email: e, emailVerified: true } : null; };

export async function clienteOnAuth(cb) {
  if (modoDemo) { clienteListeners.add(cb); cb(demoSessaoCliente()); return; }
  await initFirebase();
  au.onAuthStateChanged(fauth, (u) => cb(u ? { uid: u.uid, email: u.email, emailVerified: u.emailVerified } : null));
}

export async function clienteCadastrar(email, senha) {
  if (modoDemo) {
    const us = demoUsuarios();
    if (us[email]) throw { code: 'auth/email-already-in-use' };
    us[email] = { senha, uid: 'c' + novoId() };
    localStorage.setItem(LS + 'usuarios', JSON.stringify(us));
    localStorage.setItem(LS + 'sessao_cliente', email);
    const u = demoSessaoCliente(); clienteListeners.forEach((cb) => cb(u)); return u;
  }
  await initFirebase();
  au.useDeviceLanguage(fauth);
  // o e-mail de confirmação só sai depois que o perfil (com o CPF) for aceito: clienteReenviarConfirmacao()
  const cred = await au.createUserWithEmailAndPassword(fauth, email, senha);
  return { uid: cred.user.uid, email: cred.user.email, emailVerified: false };
}

// Desfaz uma conta recém-criada (ex.: o CPF já tem cadastro em outra conta)
export async function clienteDesfazerCadastro() {
  if (modoDemo) {
    const e = localStorage.getItem(LS + 'sessao_cliente'); const us = demoUsuarios(); delete us[e];
    localStorage.setItem(LS + 'usuarios', JSON.stringify(us)); localStorage.removeItem(LS + 'sessao_cliente');
    clienteListeners.forEach((cb) => cb(null)); return;
  }
  await fauth.currentUser?.delete().catch(() => au.signOut(fauth));
}

// Perfil do cliente + trava do CPF (cpfs/{cpf}) na mesma operação: as regras recusam se o CPF já for de outra conta.
export class CpfEmUso extends Error { constructor() { super('cpf-em-uso'); this.code = 'cpf-em-uso'; } }
export async function salvarPerfil(uid, dados, cpfAntigo = '') {
  if (modoDemo) {
    const travas = lsGet('cpfs');
    if (dados.cpf && travas[dados.cpf] && travas[dados.cpf].uid !== uid) throw new CpfEmUso();
    if (cpfAntigo && cpfAntigo !== dados.cpf && travas[cpfAntigo]?.uid === uid) delete travas[cpfAntigo];
    if (dados.cpf) travas[dados.cpf] = { uid };
    lsSet('cpfs', travas); await set('clientes', uid, dados); return;
  }
  await initFirebase();
  const lote = fs.writeBatch(fdb);
  lote.set(fs.doc(fdb, 'clientes', uid), dados);
  if (dados.cpf) lote.set(fs.doc(fdb, 'cpfs', dados.cpf), { uid });
  if (cpfAntigo && cpfAntigo !== dados.cpf) lote.delete(fs.doc(fdb, 'cpfs', cpfAntigo));
  try { await lote.commit(); }
  catch (e) { if (/permission/i.test(e.code || e.message)) throw new CpfEmUso(); throw e; }
}

export async function clienteEntrar(email, senha) {
  if (modoDemo) {
    const u = demoUsuarios()[email];
    if (!u || u.senha !== senha) throw { code: 'auth/invalid-credential' };
    localStorage.setItem(LS + 'sessao_cliente', email);
    const s = demoSessaoCliente(); clienteListeners.forEach((cb) => cb(s)); return s;
  }
  await initFirebase();
  const cred = await au.signInWithEmailAndPassword(fauth, email, senha);
  return { uid: cred.user.uid, email: cred.user.email, emailVerified: cred.user.emailVerified };
}

export async function clienteReenviarConfirmacao() {
  if (modoDemo) return;
  await au.sendEmailVerification(fauth.currentUser, { url: location.href.split('#')[0] });
}

// Recarrega o usuário para saber se ele já clicou no link do e-mail
export async function clienteVerificarEmail() {
  if (modoDemo) return true;
  await fauth.currentUser.reload();
  await fauth.currentUser.getIdToken(true); // atualiza o token para as regras do Firestore
  return fauth.currentUser.emailVerified;
}

export async function clienteSair() {
  if (modoDemo) { localStorage.removeItem(LS + 'sessao_cliente'); clienteListeners.forEach((cb) => cb(null)); return; }
  await au.signOut(fauth);
}

// ---------------------------------------------------------------- CRUD
export async function query(col, campo, valor) {
  if (modoDemo) return (await list(col)).filter((d) => d[campo] === valor);
  await initFirebase();
  const snap = await fs.getDocs(fs.query(fs.collection(fdb, col), fs.where(campo, '==', valor)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function list(col) {
  if (modoDemo) return Object.entries(lsGet(col)).map(([id, v]) => ({ id, ...v }));
  await initFirebase();
  const snap = await fs.getDocs(fs.collection(fdb, col));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function get(col, id) {
  if (modoDemo) { const v = lsGet(col)[id]; return v ? { id, ...v } : null; }
  await initFirebase();
  const d = await fs.getDoc(fs.doc(fdb, col, id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function add(col, obj) {
  if (modoDemo) { const all = lsGet(col); const id = novoId(); all[id] = obj; lsSet(col, all); return id; }
  await initFirebase();
  const ref = await fs.addDoc(fs.collection(fdb, col), obj);
  return ref.id;
}

// Pré-reserva do site: grava a solicitação e a marca "uma pré-reserva por vez" (preReservaAtiva/{uid})
// na mesma operação. As regras só aceitam se o cliente não tiver outra aguardando pagamento.
export async function novaSolicitacao(uid, obj) {
  if (modoDemo) { const id = await add('solicitacoes', obj); await set('preReservaAtiva', uid, { sol: id }); return id; }
  await initFirebase();
  const ref = fs.doc(fs.collection(fdb, 'solicitacoes'));
  const lote = fs.writeBatch(fdb);
  lote.set(ref, obj);
  lote.set(fs.doc(fdb, 'preReservaAtiva', uid), { sol: ref.id });
  await lote.commit();
  return ref.id;
}

export async function set(col, id, obj) {
  if (modoDemo) { const all = lsGet(col); all[id] = obj; lsSet(col, all); return; }
  await initFirebase();
  await fs.setDoc(fs.doc(fdb, col, id), obj);
}

export async function update(col, id, obj) {
  if (modoDemo) { const all = lsGet(col); all[id] = { ...(all[id] || {}), ...obj }; lsSet(col, all); return; }
  await initFirebase();
  await fs.updateDoc(fs.doc(fdb, col, id), obj);
}

export async function remove(col, id) {
  if (modoDemo) { const all = lsGet(col); delete all[id]; lsSet(col, all); return; }
  await initFirebase();
  await fs.deleteDoc(fs.doc(fdb, col, id));
}

// Dados de exemplo para o modo demonstração (só na primeira vez)
export function semearDemo() {
  if (!modoDemo || localStorage.getItem(LS + 'semeado')) return;
  const hoje = new Date();
  const d = (dias) => { const x = new Date(hoje); x.setDate(x.getDate() + dias); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const res = {
    a1: { cliente: 'Mariana Alves', telefone: '27999990001', data: d(1), periodo: '24h', horaEntrada: '09:00', evento: 'Aniversário', valor: 1000, taxaLimpeza: 75, status: 'confirmada', obs: '', pagamentos: [{ valor: 500, data: d(-10), forma: 'Pix' }], criadoEm: d(-10) },
    a2: { cliente: 'Rafael Costa', telefone: '27999990002', data: d(7), periodo: '12h', horaEntrada: '10:00', evento: 'Confraternização', valor: 770, taxaLimpeza: 75, status: 'confirmada', obs: 'Vai levar som próprio', pagamentos: [{ valor: 845, data: d(-3), forma: 'Pix' }], criadoEm: d(-3) },
    a3: { cliente: 'Beatriz Lima', telefone: '27999990003', data: d(14), periodo: '24h', horaEntrada: '09:00', evento: 'Chá de bebê', valor: 1000, taxaLimpeza: 75, status: 'pendente', obs: '', pagamentos: [], criadoEm: d(-1) },
    a4: { cliente: 'Carlos Souza', telefone: '27999990004', data: d(-6), periodo: '24h', horaEntrada: '09:00', evento: 'Churrasco', valor: 1000, taxaLimpeza: 75, status: 'concluida', obs: '', pagamentos: [{ valor: 1075, data: d(-20), forma: 'Dinheiro' }], criadoEm: d(-20) }
  };
  lsSet('reservas', res);
  const ocup = {};
  Object.values(res).forEach((r) => { if (['pendente', 'confirmada', 'concluida'].includes(r.status)) ocup[r.data] = { status: 'reservado' }; });
  lsSet('ocupacao', ocup);
  lsSet('despesas', {
    b1: { data: d(-8), categoria: 'Produtos de piscina', descricao: 'Cloro e clarificante', valor: 180 },
    b2: { data: d(-5), categoria: 'Luz', descricao: 'Conta de energia', valor: 320 },
    b3: { data: d(-4), categoria: 'Material de limpeza', descricao: 'Detergente, desinfetante, sacos', valor: 95 }
  });
  lsSet('fotos', { f1: { thumb: 'assets/banner.jpg', legenda: 'Piscina e área de lazer', ordem: 0 } });
  lsSet('fotosFull', { f1: { img: 'assets/banner.jpg' } });
  localStorage.setItem(LS + 'semeado', '1');
}
