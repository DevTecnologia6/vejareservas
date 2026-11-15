// Publica firestore.rules no Firebase (roda no GitHub Actions a cada alteração do arquivo)
import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

const { FIREBASE_SERVICE_ACCOUNT } = process.env;
if (!FIREBASE_SERVICE_ACCOUNT) { console.log('⏸ Secret FIREBASE_SERVICE_ACCOUNT não configurado.'); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });

const fonte = readFileSync('firestore.rules', 'utf8');
try {
  const r = await admin.securityRules().releaseFirestoreRulesetFromSource(fonte);
  console.log('✅ Regras publicadas:', r.name, r.createTime);
} catch (e) {
  console.error('❌ As regras NÃO foram publicadas (o Firebase recusou):');
  console.error(e.message);
  process.exit(1);
}
