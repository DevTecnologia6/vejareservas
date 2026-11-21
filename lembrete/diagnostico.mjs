// Diagnóstico das contas de clientes (sem dados pessoais nos logs: só a inicial do nome)
import admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const [cli, bloq, bloqE, pub] = await Promise.all([db.collection('clientes').get(), db.collection('bloqueados').get(), db.collection('bloqueiosEmail').get(), db.doc('publico/info').get()]);
console.log(`publico/info existe: ${pub.exists} | clientes: ${cli.size} | bloqueados: ${bloq.size} | bloqueiosEmail: ${bloqE.size}`);
// contas com o mesmo CPF (criadas antes da trava "uma conta por CPF") — o CPF nunca é impresso
const porCpf = {}; cli.docs.forEach((d) => { const c = d.data().cpf; if (c) (porCpf[c] = porCpf[c] || []).push((d.data().nome || '?')[0] + '.'); });
const repetidos = Object.values(porCpf).filter((l) => l.length > 1);
console.log(`CPFs repetidos: ${repetidos.length}${repetidos.length ? ' → ' + repetidos.map((l) => l.join(' e ')).join(' | ') + ' (veja em Clientes no painel: selo "CPF repetido")' : ''}`);
const idsBloq = new Set(bloq.docs.map((d) => d.id)), emailsBloq = new Set(bloqE.docs.map((d) => d.id));
const { users } = await admin.auth().listUsers(1000);
for (const u of users) {
  const c = cli.docs.find((d) => d.id === u.uid);
  const ini = c ? (c.data().nome || '?')[0] + '.' : '(sem perfil)';
  console.log(`${ini.padEnd(13)} verificado=${u.emailVerified} desativado=${u.disabled} bloqueado=${idsBloq.has(u.uid) || emailsBloq.has((u.email || '').toLowerCase())} provedores=${u.providerData.map((p) => p.providerId).join('+')} criado=${u.metadata.creationTime?.slice(5, 16)} ultimoLogin=${u.metadata.lastSignInTime?.slice(5, 22)}`);
}
