// =====================================================================
//  Gerador de Pix "copia e cola" (BR Code / EMV estático do Banco Central)
// =====================================================================
const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor;

// remove acentos e caracteres fora do padrão
const limpar = (s, max) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, max).toUpperCase();

export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Normaliza a chave conforme o tipo escolhido nas configurações
export function normalizarChave(chave, tipo) {
  const c = String(chave || '').trim();
  const d = c.replace(/\D/g, '');
  if (tipo === 'celular') return '+55' + d.replace(/^55(?=\d{10,11}$)/, '');
  if (tipo === 'cpf') return d;
  return c; // e-mail ou chave aleatória
}

/**
 * @param {Object} o { chave, tipo ('cpf'|'celular'|'email'|'aleatoria'), nome, cidade, valor, txid, descricao }
 */
export function gerarPix({ chave, tipo, nome, cidade, valor, txid = '***', descricao = '' }) {
  const gui = campo('00', 'br.gov.bcb.pix') + campo('01', normalizarChave(chave, tipo)) + (descricao ? campo('02', limpar(descricao, 40)) : '');
  let payload =
    campo('00', '01') +
    campo('26', gui) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor > 0 ? campo('54', Number(valor).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(nome, 25) || 'RECEBEDOR') +
    campo('60', limpar(cidade, 15) || 'BRASIL') +
    campo('62', campo('05', limpar(txid, 25).replace(/ /g, '') || '***'));
  payload += '6304';
  return payload + crc16(payload);
}

// Desenha o QR Code (usa js/vendor/qrcode.js, carregado como <script>)
export function qrSVG(texto, tamanho = 220) {
  const qr = window.qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount(), m = 2, total = n + m * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + m} ${y + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${tamanho}" height="${tamanho}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
