// =====================================================================
//  Campos de cadastro do cliente: exemplos, máscaras e busca de CEP
// =====================================================================
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const so = (s) => String(s || '').replace(/\D/g, '');

export const mascaraCpf = (v) => { const d = so(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); };
export const mascaraFone = (v) => { const d = so(v).slice(0, 11); if (d.length <= 2) return d.length ? `(${d}` : ''; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };
export const mascaraCep = (v) => { const d = so(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

/** Campos de dados pessoais (nome, WhatsApp, CPF) */
export function htmlDadosPessoais(p = {}, { nome = true } = {}) {
  return `
    ${nome ? `<label class="campo inteiro">Nome completo *<input name="nome" required minlength="5" maxlength="80" autocomplete="name" placeholder="Ex.: Maria Aparecida da Silva" value="${esc(p.nome)}"></label>` : ''}
    <label class="campo">WhatsApp (com DDD) *<input name="telefone" required inputmode="numeric" autocomplete="tel" placeholder="Ex.: (27) 99999-9999" data-mascara="fone" value="${esc(mascaraFone(p.telefone))}"></label>
    <label class="campo">CPF (só números) *<input name="cpf" required inputmode="numeric" placeholder="Ex.: 000.000.000-00" data-mascara="cpf" value="${esc(mascaraCpf(p.cpf))}"></label>`;
}

/** Campos de endereço separados (CEP preenche rua, bairro e cidade) */
export function htmlEndereco(p = {}) {
  const e = p.end || {};
  return `
    <label class="campo">CEP *<input name="cep" required inputmode="numeric" placeholder="Ex.: 29175-000" data-mascara="cep" value="${esc(mascaraCep(e.cep))}"><span class="horario-info" data-cep-msg></span></label>
    <label class="campo">Número *<input name="numero" required maxlength="10" placeholder="Ex.: 21 (ou S/N)" value="${esc(e.numero)}"></label>
    <label class="campo inteiro">Rua / Avenida *<input name="rua" required minlength="3" maxlength="80" placeholder="Ex.: Av. dos Corais" value="${esc(e.rua)}"></label>
    <label class="campo">Bairro *<input name="bairro" required minlength="2" maxlength="50" placeholder="Ex.: Praia de Capuba" value="${esc(e.bairro)}"></label>
    <label class="campo">Cidade / UF *<input name="cidade" required minlength="4" maxlength="50" placeholder="Ex.: Serra/ES" value="${esc(e.cidade)}"></label>`;
}

/** Liga as máscaras e a busca de CEP aos campos dentro de `el` */
export function ligarCampos(el) {
  const fmt = { cpf: mascaraCpf, fone: mascaraFone, cep: mascaraCep };
  el.querySelectorAll('[data-mascara]').forEach((inp) => {
    inp.addEventListener('input', () => { inp.value = fmt[inp.dataset.mascara](inp.value); });
  });
  const cep = el.querySelector('[name=cep]');
  if (!cep) return;
  cep.addEventListener('input', async () => {
    const d = so(cep.value);
    const msg = el.querySelector('[data-cep-msg]');
    if (d.length !== 8) { msg.textContent = ''; return; }
    msg.textContent = 'Buscando endereço…';
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`).then((x) => x.json());
      if (r.erro) { msg.textContent = 'CEP não encontrado. Preencha o endereço manualmente.'; return; }
      const set = (n, v) => { const i = el.querySelector(`[name=${n}]`); if (i && v) i.value = v; };
      set('rua', r.logradouro); set('bairro', r.bairro); set('cidade', r.localidade && r.uf ? `${r.localidade}/${r.uf}` : '');
      msg.textContent = '✓ Endereço encontrado — confira e informe o número.';
      el.querySelector('[name=numero]')?.focus();
    } catch { msg.textContent = 'Não foi possível buscar o CEP. Preencha manualmente.'; }
  });
}

/** Lê e valida os campos. Retorna { erro } ou { dados } */
export function lerCadastro(fd, { exigirNome = true } = {}) {
  const g = (k) => String(fd.get(k) || '').trim();
  const nome = g('nome'), tel = so(g('telefone')), cpf = so(g('cpf'));
  if (exigirNome && nome.split(/\s+/).length < 2) return { erro: 'Informe o nome completo (nome e sobrenome).' };
  if (tel.length !== 11) return { erro: 'Informe o WhatsApp com DDD + 9 dígitos. Ex.: (27) 99999-9999.' };
  if (cpf.length !== 11) return { erro: 'O CPF precisa ter exatamente 11 números.' };
  const end = { cep: so(g('cep')), rua: g('rua'), numero: g('numero'), bairro: g('bairro'), cidade: g('cidade') };
  if (end.cep.length !== 8) return { erro: 'Informe o CEP com 8 números.' };
  if (!end.rua || !end.numero || !end.bairro || !end.cidade) return { erro: 'Preencha todos os campos do endereço.' };
  const endereco = `${end.rua}, ${end.numero}, ${end.bairro}, ${end.cidade}, CEP ${mascaraCep(end.cep)}`;
  return { dados: { ...(exigirNome ? { nome } : {}), telefone: tel, cpf, end, endereco } };
}
