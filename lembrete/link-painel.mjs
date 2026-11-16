// Gera o link de autorização do painel e manda SÓ para o WhatsApp do dono (não usa a cota de e-mails do Firebase).
// O link nunca é impresso no log (o repositório é público).
import admin from 'firebase-admin';
const { FIREBASE_SERVICE_ACCOUNT, CALLMEBOT_PHONE, CALLMEBOT_APIKEY } = process.env;
if (!FIREBASE_SERVICE_ACCOUNT || !CALLMEBOT_PHONE || !CALLMEBOT_APIKEY) { console.log('Faltam os secrets.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
const link = await admin.auth().generateSignInWithEmailLink('devtecnologia6@gmail.com', {
  url: 'https://espacoveja.devtecnologia.app.br/painel.html', handleCodeInApp: true
});
const texto = `🔐 VejaReservas — link para autorizar um aparelho no painel:\n\n${link}\n\nNo atalho do celular: segure o dedo no link → Copiar, e cole em "Já recebi o link". Depois digite a senha do painel. Se não foi você que pediu, ignore.`;
const r = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(CALLMEBOT_PHONE)}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(CALLMEBOT_APIKEY)}`);
const ok = r.ok && !/invalid|error/i.test(await r.text());
console.log(ok ? '✅ Link enviado para o seu WhatsApp.' : `❌ CallMeBot não aceitou (HTTP ${r.status}).`);
process.exit(ok ? 0 : 1);
