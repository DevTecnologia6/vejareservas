// =====================================================================
//  Limites de todos os campos (datas, horas, números, textos, CPF, telefone)
//  Aplicado automaticamente em qualquer formulário que aparecer na tela.
// =====================================================================
import { mascaraCpf, mascaraFone, mascaraCep } from './campos.js';

const MASCARAS = { cpf: mascaraCpf, fone: mascaraFone, cep: mascaraCep };

// regras por nome do campo
const POR_NOME = {
  cliente: { maxlength: 80 }, nome: { maxlength: 80 }, locadorNome: { maxlength: 80 }, pixNome: { maxlength: 25 }, pixCidade: { maxlength: 15 },
  descricao: { maxlength: 100 }, evento: { maxlength: 60 }, foro: { maxlength: 40 }, horarios: { maxlength: 80 },
  imovelEndereco: { maxlength: 150 }, locadorEndereco: { maxlength: 150 }, clienteEndereco: { maxlength: 150 },
  rua: { maxlength: 80 }, bairro: { maxlength: 50 }, cidade: { maxlength: 50 }, numero: { maxlength: 10 },
  pixChave: { maxlength: 77 }, email: { maxlength: 100 }, senha: { maxlength: 64 }, senha2: { maxlength: 64 },
  obs: { maxlength: 400 }, motivo: { maxlength: 300 }, regras: { maxlength: 2000 }, clausulas: { maxlength: 15000 },
  telefone: { mascara: 'fone', maxlength: 15 }, whatsapp: { mascara: 'fone', maxlength: 15 },
  cpf: { mascara: 'cpf', maxlength: 14 }, clienteCpf: { mascara: 'cpf', maxlength: 14 }, locadorCpf: { mascara: 'cpf', maxlength: 14 },
  cep: { mascara: 'cep', maxlength: 9 },
  valor: { min: 0, max: 999999 }, sinal: { min: 0, max: 999999 }, taxaLimpeza: { min: 0, max: 99999 },
  preco12: { min: 0, max: 999999 }, preco24: { min: 0, max: 999999 },
  dias: { min: 1, max: 30, inteiro: true }, prazoPagamentoMin: { min: 5, max: 1440, inteiro: true }
};

const ANO_MIN = 2020, ANO_MAX = 2099;

function validarData(inp) {
  const v = inp.value;
  if (!v) { inp.setCustomValidity(''); return; }
  const ano = +v.split('-')[0];
  inp.setCustomValidity(v.split('-')[0].length !== 4 || ano < ANO_MIN || ano > ANO_MAX ? `Informe uma data válida (ano entre ${ANO_MIN} e ${ANO_MAX}).` : '');
}

function validarHora(inp) {
  const v = inp.value;
  inp.setCustomValidity(!v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v.slice(0, 5)) ? '' : 'Informe um horário válido (00:00 a 23:59).');
}

function validarNumero(inp, r) {
  if (inp.value === '') { inp.setCustomValidity(''); return; }
  if (inp.value.replace(/[^\d]/g, '').length > 9) inp.value = inp.value.slice(0, 9);
  const n = +inp.value;
  const min = inp.min !== '' ? +inp.min : -Infinity, max = inp.max !== '' ? +inp.max : Infinity;
  if (r?.inteiro && !Number.isInteger(n)) inp.setCustomValidity('Use um número inteiro.');
  else if (n < min || n > max) inp.setCustomValidity(`Use um valor entre ${min} e ${max}.`);
  else inp.setCustomValidity('');
}

export function aplicarLimites(raiz = document) {
  raiz.querySelectorAll?.('input, textarea').forEach((inp) => {
    if (inp.dataset.lim) return;
    inp.dataset.lim = '1';
    const r = POR_NOME[inp.name] || {};
    const tipo = inp.type;
    if (tipo === 'date') {
      if (!inp.min) inp.min = `${ANO_MIN}-01-01`;
      if (!inp.max) inp.max = `${ANO_MAX}-12-31`;
      ['input', 'change', 'blur'].forEach((ev) => inp.addEventListener(ev, () => validarData(inp)));
      return;
    }
    if (tipo === 'time') {
      inp.step = 60;
      ['input', 'change', 'blur'].forEach((ev) => inp.addEventListener(ev, () => validarHora(inp)));
      return;
    }
    if (tipo === 'number') {
      if (r.min != null && inp.min === '') inp.min = r.min;
      if (r.max != null) inp.max = r.max;
      if (inp.min === '') inp.min = 0;
      if (inp.max === '') inp.max = 9999999;
      ['input', 'change', 'blur'].forEach((ev) => inp.addEventListener(ev, () => validarNumero(inp, r)));
      return;
    }
    if (['checkbox', 'radio', 'file', 'hidden', 'submit', 'button'].includes(tipo)) return;
    // textos
    if (r.maxlength) inp.maxLength = Math.min(inp.maxLength > 0 ? inp.maxLength : Infinity, r.maxlength);
    else if (!(inp.maxLength > 0)) inp.maxLength = inp.tagName === 'TEXTAREA' ? 500 : 120;
    if (r.mascara && !inp.dataset.mascara) {
      inp.dataset.mascara = r.mascara;
      inp.inputMode = 'numeric';
      const fmt = MASCARAS[r.mascara];
      if (inp.value) inp.value = fmt(inp.value);
      inp.addEventListener('input', () => { inp.value = fmt(inp.value); });
    }
  });
}

// aplica em tudo que aparecer na tela (formulários são criados dinamicamente)
const obs = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && aplicarLimites(n))));
const iniciar = () => { aplicarLimites(document); obs.observe(document.body, { childList: true, subtree: true }); };
if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
