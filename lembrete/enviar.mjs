// =====================================================================
//  VejaReservas — robô de lembrete (roda todo dia no GitHub Actions)
//  Procura locações de AMANHÃ e manda um WhatsApp para o dono via CallMeBot.
//
//  Variáveis (GitHub > Settings > Secrets and variables > Actions):
//    FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço do Firebase
//    CALLMEBOT_PHONE           seu número com +55, ex.: +5527999999999
//    CALLMEBOT_APIKEY          a chave que o bot do CallMeBot te enviou
// =====================================================================
import admin from 'firebase-admin';

const { FIREBASE_SERVICE_ACCOUNT, CALLMEBOT_PHONE, CALLMEBOT_APIKEY, DATA_TESTE } = process.env;
if (!FIREBASE_SERVICE_ACCOUNT || !CALLMEBOT_PHONE || !CALLMEBOT_APIKEY) {
  console.log('⏸ Lembrete ainda não configurado: faltam os secrets FIREBASE_SERVICE_ACCOUNT, CALLMEBOT_PHONE e/ou CALLMEBOT_APIKEY. Nada foi enviado.');
  process.exit(0);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso) => iso.split('-').reverse().join('/');
function saidaTxt(r) {
  if (!r.data || !r.horaEntrada) return '';
  const [h, m] = r.horaEntrada.split(':').map(Number);
  const d = new Date(`${r.data}T00:00:00Z`);
  // mesma conta de horasDe() em js/calendar.js: diárias + 12h se tiver meia diária
  d.setUTCHours(h + ((+r.dias || 1) > 1 ? 24 * r.dias : r.periodo === '12h' ? 12 : 24) + (r.meia ? 12 : 0), m);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} às ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
// mesmo texto de periodoTxt() em js/calendar.js: "12h", "24h", "3 diárias", "3 diárias + 12h"
const periodoTxt = (r) => ((+r.dias || 1) > 1 ? `${r.dias} diárias` : r.meia ? '1 diária' : r.periodo || '24h') + (r.meia ? ' + 12h' : '');
const fone = (s) => { const d = String(s || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d || 'não informado'; };

// "amanhã" no fuso de Brasília
// aceita a data de teste como AAAA-MM-DD ou DD/MM/AAAA
const dataTeste = (DATA_TESTE || '').trim().replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1');
const amanha = dataTeste || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + 86400000));

async function enviarWhatsApp(texto) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(CALLMEBOT_PHONE)}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(CALLMEBOT_APIKEY)}`;
  const r = await fetch(url);
  const corpo = await r.text();
  console.log('   CallMeBot:', corpo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160));
  if (!r.ok || /apikey is invalid|invalid apikey|error/i.test(corpo)) {
    throw new Error(`CallMeBot respondeu ${r.status}: ${corpo.replace(/<[^>]+>/g, ' ').slice(0, 300)}`);
  }
}

// Contas de clientes excluídas pelo dono no painel: apaga o login (e-mail/senha) de vez
for (const d of (await db.collection('bloqueados').where('excluirLogin', '==', true).get()).docs) {
  if (d.data().loginExcluidoEm) continue;
  try { await admin.auth().deleteUser(d.id); console.log(`🗑 Login excluído: ${d.data().email || d.id}`); }
  catch (e) { if (e.code !== 'auth/user-not-found') { console.error('Erro ao excluir login', d.id, e.message); continue; } }
  await d.ref.update({ loginExcluidoEm: new Date().toISOString() });
}

const cfgDoc = await db.doc('config/geral').get();
const nomeEspaco = cfgDoc.exists ? cfgDoc.data().nome || 'Espaço Veja' : 'Espaço Veja';

const snap = await db.collection('reservas').where('data', '==', amanha).get();
const reservas = snap.docs.map((d) => d.data()).filter((r) => ['pendente', 'confirmada'].includes(r.status));

console.log(`📅 Verificando ${br(amanha)} — ${reservas.length} locação(ões).`);

// Aviso de pré-reservas do site aguardando aprovação
if (!DATA_TESTE) {
  const sols = (await db.collection('solicitacoes').get()).docs.map((d) => d.data()).filter((s) => (!s.status || s.status === 'aguardando') && (s.pagoInformadoEm || !s.expiraEm || s.expiraEm > Date.now())).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  if (sols.length) {
    const linhas = sols.slice(0, 10).map((s) => `• ${s.extensao ? '⏱ Mais tempo: ' : ''}${br(s.data)} — ${s.cliente} (${s.extensao ? s.obs || 'extensão' : periodoTxt(s)}) · ${s.codigo}${s.sinal ? ` · sinal ${fmt(s.sinal)}` : ''}`);
    await enviarWhatsApp([`🔔 *${sols.length} pré-reserva(s) do site aguardando aprovação*`, '', ...linhas, '', 'Confira o Pix e aprove no painel do VejaReservas.'].join('\n'));
    console.log(`🔔 Aviso de ${sols.length} pré-reserva(s) enviado.`);
    await new Promise((ok) => setTimeout(ok, 4000));
  }
}

// Aviso de pagamentos do restante informados pelos clientes (Pix a conferir)
if (!DATA_TESTE) {
  const pags = (await db.collection('pagamentosCliente').where('status', '==', 'informado').get()).docs.map((d) => d.data());
  if (pags.length) {
    const linhas = pags.slice(0, 10).map((p) => `• ${p.cliente} — ${fmt(p.valor)} (reserva de ${br(p.data)}) · ${p.codigo}`);
    await enviarWhatsApp([`💰 *${pags.length} pagamento(s) informado(s) pelo site*`, '', ...linhas, '', 'Confira se o Pix caiu e confirme no painel do VejaReservas.'].join('\n'));
    console.log(`💰 Aviso de ${pags.length} pagamento(s) enviado.`);
    await new Promise((ok) => setTimeout(ok, 4000));
  }
}

if (!reservas.length) process.exit(0);

for (const r of reservas) {
  const total = (+r.valor || 0) + (+r.taxaLimpeza || 0);
  const recebido = (r.pagamentos || []).reduce((s, p) => s + (+p.valor || 0), 0);
  const falta = Math.max(0, total - recebido);
  const msg = [
    `📅 *Lembrete: locação amanhã no ${nomeEspaco}*`,
    ``,
    `👤 *Cliente:* ${r.cliente}`,
    `📞 *Telefone:* ${fone(r.telefone)}`,
    `🎉 *Evento:* ${r.evento || '—'}`,
    `🕘 *Entrada:* ${br(r.data)} às ${r.horaEntrada || '—'} • ${periodoTxt(r)}`,
    saidaTxt(r) ? `🚪 *Saída prevista:* ${saidaTxt(r)}` : null,
    `💰 *Total:* ${fmt(total)} | recebido ${fmt(recebido)}`,
    falta > 0 ? `⚠️ *Falta receber:* ${fmt(falta)}` : `✅ *Pagamento completo*`,
    r.status === 'pendente' ? `❗ Reserva ainda está como *PENDENTE*` : null,
    r.obs ? `📝 *Obs.:* ${r.obs}` : null
  ].filter((l) => l !== null).join('\n');

  await enviarWhatsApp(msg);
  console.log(`✅ Lembrete enviado: ${r.cliente}`);
  await new Promise((ok) => setTimeout(ok, 4000)); // CallMeBot pede intervalo entre mensagens
}
