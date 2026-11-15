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

const cfgDoc = await db.doc('config/geral').get();
const nomeEspaco = cfgDoc.exists ? cfgDoc.data().nome || 'Espaço Veja' : 'Espaço Veja';

const snap = await db.collection('reservas').where('data', '==', amanha).get();
const reservas = snap.docs.map((d) => d.data()).filter((r) => ['pendente', 'confirmada'].includes(r.status));

console.log(`📅 Verificando ${br(amanha)} — ${reservas.length} locação(ões).`);

// Aviso de pré-reservas do site aguardando aprovação
if (!DATA_TESTE) {
  const sols = (await db.collection('solicitacoes').get()).docs.map((d) => d.data()).filter((s) => s.status !== 'recusada').sort((a, b) => String(a.data).localeCompare(String(b.data)));
  if (sols.length) {
    const linhas = sols.slice(0, 10).map((s) => `• ${br(s.data)} — ${s.cliente} (${s.periodo}) · ${s.codigo}${s.sinal ? ` · sinal ${fmt(s.sinal)}` : ''}`);
    await enviarWhatsApp([`🔔 *${sols.length} pré-reserva(s) do site aguardando aprovação*`, '', ...linhas, '', 'Confira o Pix e aprove no painel do VejaReservas.'].join('\n'));
    console.log(`🔔 Aviso de ${sols.length} pré-reserva(s) enviado.`);
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
    `🕘 *Data:* ${br(r.data)} • ${r.periodo} • entrada ${r.horaEntrada || '—'}`,
    `💰 *Total:* ${fmt(total)} | recebido ${fmt(recebido)}`,
    falta > 0 ? `⚠️ *Falta receber:* ${fmt(falta)}` : `✅ *Pagamento completo*`,
    r.status === 'pendente' ? `❗ Reserva ainda está como *PENDENTE*` : null,
    r.obs ? `📝 ${r.obs}` : null
  ].filter((l) => l !== null).join('\n');

  await enviarWhatsApp(msg);
  console.log(`✅ Lembrete enviado: ${r.cliente}`);
  await new Promise((ok) => setTimeout(ok, 4000)); // CallMeBot pede intervalo entre mensagens
}
