// Testes das regras do Firestore (rodam no emulador: workflow "Testar regras")
// Cada linha imprime OK ou FALHOU; o processo termina com erro se algum caso falhar.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
const env = await initializeTestEnvironment({ projectId: 'demo-veja', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });

// horário de Brasília (UTC-3), igual a js/calendar.js
const H = 3600e3;
const ms = (data, hora) => Date.parse(`${data}T${hora}:00-03:00`);

await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await d.doc('publico/info').set({ nome: 'X', preReserva: true, preco12: 770, preco24: 1000, taxaLimpeza: 75, sinalPct: 50, prazoPagamentoMin: 30, intervaloH: 4 });
  await d.doc('ocupacao/2026-12-01').set({ status: 'reservado' });
  await d.doc('clientes/ane').set({ nome: 'Ane' });
  // reserva confirmada do Dan (24h, 10/02 08:00 → 11/02 08:00) para testar a extensão
  await d.doc('reservas/r1').set({ clienteUid: 'dan', status: 'confirmada', data: '2027-02-10', dias: 1, periodo: '24h', horaEntrada: '08:00', valor: 1000, taxaLimpeza: 0 });
  await d.doc('ocupacao/2027-02-10').set({ status: 'reservado', ini: ms('2027-02-10', '08:00'), fim: ms('2027-02-11', '08:00') });
  // locação de outra pessoa começando 13/02 às 10:00 (limita a extensão do Dan)
  await d.doc('ocupacao/2027-02-13').set({ status: 'reservado', ini: ms('2027-02-13', '10:00'), fim: ms('2027-02-14', '10:00') });
});

let falhas = 0;
const r = async (n, p) => { try { await p; console.log('OK    ', n); } catch (e) { falhas++; console.log('FALHOU', n, '→', e.message.split('\n')[0]); } };
const tok = (email, extra) => ({ email, email_verified: true, auth_time: 1700000000, ...extra });
const ctx = (uid) => env.authenticatedContext(uid, tok(`${uid}@x.com`)).firestore();
// grava a pré-reserva junto com a marca "uma por vez", como o site faz (db.novaSolicitacao)
const enviar = (db, uid, id, dados) => { const b = db.batch(); b.set(db.doc(`solicitacoes/${id}`), dados); b.set(db.doc(`preReservaAtiva/${uid}`), { sol: id }); return b.commit(); };

const EXP = Date.now() + 20 * 60000;
const sol = (uid, extra = {}) => {
  const s = { uid, email: `${uid}@x.com`, cliente: 'Cliente Teste', telefone: '27999998888', data: '2027-01-16', dias: 3, periodo: '24h', horaEntrada: '08:00', evento: 'Festa', obs: '', valor: 3000, taxaLimpeza: 0, total: 3000, sinal: 1500, codigo: 'VEJA1', status: 'aguardando', criadoEm: 'x', expiraEm: EXP, aceitouRegras: true, aceiteContrato: 'x', ...extra };
  const horas = (s.dias > 1 ? 24 * s.dias : s.periodo === '12h' ? 12 : 24) + (s.meia ? 12 : 0);
  const n = s.dias + (s.meia ? 1 : 0);
  const dia = (k) => new Date(Date.parse(`${s.data}T12:00:00Z`) + k * 864e5).toISOString().slice(0, 10);
  const ini = ms(s.data, s.horaEntrada);
  return { ini, fim: ini + horas * H, antes: dia(-1), depois: dia(n), ...s, ...extra };
};

const ane = ctx('ane');
// ---- leitura
await r('cliente lê publico/info', assertSucceeds(ane.doc('publico/info').get()));
await r('cliente lista ocupacao', assertSucceeds(ane.collection('ocupacao').get()));
await r('cliente lê o próprio perfil', assertSucceeds(ane.doc('clientes/ane').get()));
const nv = env.authenticatedContext('nv', tok('nv@x.com', { email_verified: false })).firestore();
await r('não verificado bloqueado', assertFails(nv.doc('publico/info').get()));

// ---- pré-reserva normal + uma por vez
await r('pré-reserva sem a marca "uma por vez" recusada', assertFails(ane.doc('solicitacoes/s0').set(sol('ane'))));
await r('pré-reserva 3 diárias (16 a 18/01, 08:00)', assertSucceeds(enviar(ane, 'ane', 's1', sol('ane'))));
await r('2ª pré-reserva com a 1ª aguardando recusada', assertFails(enviar(ane, 'ane', 's2', sol('ane', { data: '2027-03-01', dias: 1, valor: 1000, total: 1000, sinal: 500, codigo: 'VEJA2' }))));
await r('segura 16/01 com o horário da pré-reserva', assertSucceeds(ane.doc('ocupacao/2027-01-16').set({ status: 'pendente', expiraEm: EXP, sol: 's1', ini: ms('2027-01-16', '08:00'), fim: ms('2027-01-19', '08:00') })));
await r('segurar sem o horário recusado', assertFails(ane.doc('ocupacao/2027-01-17').set({ status: 'pendente', expiraEm: EXP, sol: 's1' })));
await r('segura 17 e 18/01', assertSucceeds(Promise.all(['17', '18'].map((d) => ane.doc(`ocupacao/2027-01-${d}`).set({ status: 'pendente', expiraEm: EXP, sol: 's1', ini: ms('2027-01-16', '08:00'), fim: ms('2027-01-19', '08:00') })))));
await r('não segura 19/01 (fora das diárias)', assertFails(ane.doc('ocupacao/2027-01-19').set({ status: 'pendente', expiraEm: EXP, sol: 's1', ini: ms('2027-01-16', '08:00'), fim: ms('2027-01-19', '08:00') })));

// ---- intervalo de limpeza (4h): Ane sai 19/01 às 08:00
const bia = ctx('bia');
await r('entrada 19/01 08:00 colada na saída recusada', assertFails(enviar(bia, 'bia', 'b1', sol('bia', { data: '2027-01-19', dias: 1, valor: 1000, total: 1000, sinal: 500 }))));
await r('entrada 19/01 11:00 (só 3h de folga) recusada', assertFails(enviar(bia, 'bia', 'b1', sol('bia', { data: '2027-01-19', dias: 1, horaEntrada: '11:00', valor: 1000, total: 1000, sinal: 500 }))));
await r('entrada 19/01 12:00 (4h de folga) aceita', assertSucceeds(enviar(bia, 'bia', 'b1', sol('bia', { data: '2027-01-19', dias: 1, horaEntrada: '12:00', valor: 1000, total: 1000, sinal: 500 }))));
const carl = ctx('carl');
// locação que terminaria em cima da entrada da Ane (15/01 14:00 + 24h = 16/01 14:00)
await r('saída colada na próxima entrada recusada', assertFails(enviar(carl, 'carl', 'c1', sol('carl', { data: '2027-01-15', dias: 1, horaEntrada: '14:00', valor: 1000, total: 1000, sinal: 500 }))));
await r('12h em 15/01 08:00 (sai 20:00) aceita', assertSucceeds(enviar(carl, 'carl', 'c1', sol('carl', { data: '2027-01-15', dias: 1, periodo: '12h', valor: 770, total: 770, sinal: 385 }))));
const eve = ctx('eve');
await r('horário (ini) diferente da hora de entrada recusado', assertFails(enviar(eve, 'eve', 'e1', sol('eve', { data: '2027-04-01', dias: 1, valor: 1000, total: 1000, sinal: 500, ini: ms('2027-04-01', '10:00') }))));
await r('dia "depois" errado recusado', assertFails(enviar(eve, 'eve', 'e1', sol('eve', { data: '2027-04-01', dias: 1, valor: 1000, total: 1000, sinal: 500, depois: '2027-04-05' }))));
await r('meia com preço errado recusada', assertFails(enviar(eve, 'eve', 'e1', sol('eve', { data: '2027-04-01', meia: true }))));
await r('3 diárias + meia aceita', assertSucceeds(enviar(eve, 'eve', 'e1', sol('eve', { data: '2027-04-01', meia: true, valor: 3770, total: 3770, sinal: 1885 }))));

// ---- extensão (pedir mais tempo) — Dan: reserva 24h 10/02 08:00 → 11/02 08:00
const dan = ctx('dan');
const ext = (extra = {}) => ({ uid: 'dan', email: 'dan@x.com', cliente: 'Dan Teste', telefone: '27999997777', data: '2027-02-10', dias: 2, periodo: '24h', horaEntrada: '08:00', evento: '', obs: 'Extensão + 1 diária', valor: 1000, taxaLimpeza: 0, total: 1000, sinal: 500, codigo: 'VEJA9', status: 'aguardando', criadoEm: 'x', expiraEm: EXP, aceitouRegras: true, extensao: 'r1', marcaIni: '2027-02-11', ini: ms('2027-02-11', '08:00'), fim: ms('2027-02-12', '08:00'), depois: '2027-02-12', ...extra });
await r('extensão com valor errado recusada', assertFails(enviar(dan, 'dan', 'x1', ext({ valor: 500, total: 500, sinal: 250 }))));
await r('extensão da reserva de outra pessoa recusada', assertFails(enviar(eve, 'eve', 'x9', ext({ uid: 'eve', email: 'eve@x.com' }))));
// +2 diárias terminaria 13/02 08:00, só 2h antes da próxima entrada (10:00)
await r('extensão colada na próxima locação recusada', assertFails(enviar(dan, 'dan', 'x1', ext({ dias: 3, valor: 2000, total: 2000, sinal: 1000, fim: ms('2027-02-13', '08:00'), depois: '2027-02-13' }))));
await r('extensão + 1 diária aceita', assertSucceeds(enviar(dan, 'dan', 'x1', ext())));
await r('extensão segura 11/02', assertSucceeds(dan.doc('ocupacao/2027-02-11').set({ status: 'pendente', expiraEm: EXP, sol: 'x1', ini: ms('2027-02-11', '08:00'), fim: ms('2027-02-12', '08:00') })));
await r('extensão não mexe no dia da reserva (10/02)', assertFails(dan.doc('ocupacao/2027-02-10').set({ status: 'pendente', expiraEm: EXP, sol: 'x1', ini: ms('2027-02-11', '08:00'), fim: ms('2027-02-12', '08:00') })));

// ---- cancelamento da pré-reserva
await r('cliente marca "Já paguei"', assertSucceeds(dan.doc('solicitacoes/x1').update({ pagoInformadoEm: 'agora' })));
await r('não cancela depois de informar o pagamento', assertFails(dan.doc('solicitacoes/x1').update({ status: 'cancelada' })));
await r('2ª pré-reserva com pagamento informado aguardando recusada', assertFails(enviar(dan, 'dan', 'x2', sol('dan', { data: '2027-05-01', dias: 1, valor: 1000, total: 1000, sinal: 500 }))));
await r('cancela pré-reserva ainda não paga', assertSucceeds(eve.doc('solicitacoes/e1').update({ status: 'cancelada' })));
await r('depois de cancelar pode fazer outra', assertSucceeds(enviar(eve, 'eve', 'e2', sol('eve', { data: '2027-06-01', dias: 1, valor: 1000, total: 1000, sinal: 500, codigo: 'VEJA3' }))));

// ---- pagar 100% na pré-reserva
const gil = ctx('gil');
await r('pré-reserva pagando 100% aceita', assertSucceeds(enviar(gil, 'gil', 'g1', sol('gil', { data: '2027-07-01', dias: 1, valor: 1000, total: 1000, sinal: 1000 }))));
const hel = ctx('hel');
await r('sinal acima do total recusado', assertFails(enviar(hel, 'hel', 'h1', sol('hel', { data: '2027-07-10', dias: 1, valor: 1000, total: 1000, sinal: 1200 }))));

// ---- uma conta por CPF (perfil + trava cpfs/{cpf} no mesmo lote, como db.salvarPerfil)
const perfil = (cpf) => ({ nome: 'Pessoa Teste', telefone: '27999998888', cpf });
const salvarPerfil = (db, uid, cpf, cpfAntigo) => { const b = db.batch(); b.set(db.doc(`clientes/${uid}`), perfil(cpf)); b.set(db.doc(`cpfs/${cpf}`), { uid }); if (cpfAntigo) b.delete(db.doc(`cpfs/${cpfAntigo}`)); return b.commit(); };
await r('perfil com CPF novo aceito', assertSucceeds(salvarPerfil(ane, 'ane', '52998224725')));
await r('regravar o próprio perfil com o mesmo CPF', assertSucceeds(salvarPerfil(ane, 'ane', '52998224725')));
await r('outra conta com o mesmo CPF recusada', assertFails(salvarPerfil(bia, 'bia', '52998224725')));
await r('perfil com CPF sem a trava recusado', assertFails(bia.doc('clientes/bia').set(perfil('11144477735'))));
await r('não lê a trava de CPF de outra pessoa', assertFails(bia.doc('cpfs/52998224725').get()));
await r('não apaga a trava de outra pessoa', assertFails(bia.doc('cpfs/52998224725').delete()));
await r('cliente troca de CPF e solta o antigo', assertSucceeds(salvarPerfil(ane, 'ane', '11144477735', '52998224725')));
await r('CPF liberado pode ser usado por outra conta', assertSucceeds(salvarPerfil(bia, 'bia', '52998224725')));

// ---- pagamento do restante (reserva r1 do Dan: R$ 1.000, confirmada)
const pag = (extra = {}) => ({ uid: 'dan', reservaId: 'r1', cliente: 'Dan Teste', data: '2027-02-10', valor: 500, codigo: 'VEJAP1', status: 'informado', criadoEm: new Date().toISOString(), ...extra });
await r('pagamento maior que o total recusado', assertFails(dan.doc('pagamentosCliente/r1').set(pag({ valor: 1500 }))));
await r('pagamento da reserva de outra pessoa recusado', assertFails(eve.doc('pagamentosCliente/r1').set(pag({ uid: 'eve' }))));
await r('cliente informa pagamento do restante', assertSucceeds(dan.doc('pagamentosCliente/r1').set(pag())));
await r('2º aviso enquanto o 1º aguarda recusado', assertFails(dan.doc('pagamentosCliente/r1').set(pag({ codigo: 'VEJAP2' }))));
await r('cliente não confirma o próprio pagamento', assertFails(dan.doc('pagamentosCliente/r1').update({ status: 'confirmado' })));
await env.withSecurityRulesDisabled((c) => c.firestore().doc('pagamentosCliente/r1').update({ status: 'recusado' }));
await r('depois de "não caiu" pode informar de novo', assertSucceeds(dan.doc('pagamentosCliente/r1').set(pag({ codigo: 'VEJAP3' }))));

// ---- dono
const dono = env.authenticatedContext('dono', tok('devtecnologia6@gmail.com')).firestore();
await r('dono sem senha bloqueado', assertFails(dono.doc('config/geral').get()));

await env.cleanup();
console.log(falhas ? `\n${falhas} caso(s) FALHARAM` : '\nTodos os casos passaram');
process.exit(falhas ? 1 : 0);
