// =====================================================================
//  Fotos da casa — compressão no navegador + galeria/visualizador
//  (as fotos ficam no Firestore em tamanho reduzido; o Storage do
//   Firebase exige plano pago desde out/2024)
// =====================================================================

// Reduz uma imagem para caber no Firestore (limite de 1 MB por documento)
export async function comprimir(arquivo, maxLado, qualidade, limiteBytes = 700000) {
  const url = URL.createObjectURL(arquivo);
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
  let lado = maxLado, q = qualidade, dataUrl;
  do {
    const esc = Math.min(1, lado / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    dataUrl = c.toDataURL('image/jpeg', q);
    lado = Math.round(lado * 0.85); q = Math.max(0.5, q - 0.08);
  } while (dataUrl.length > limiteBytes && lado > 300);
  URL.revokeObjectURL(url);
  return dataUrl;
}

/**
 * Visualizador em tela cheia.
 * @param {Array} fotos  [{ id, thumb, legenda }]
 * @param {number} inicio índice inicial
 * @param {Function} carregarFull (id) => Promise<string|null>  imagem em alta
 */
export function abrirVisualizador(fotos, inicio, carregarFull) {
  let i = inicio;
  const cache = {};
  const el = document.createElement('div');
  el.className = 'visualizador';
  el.innerHTML = `
    <button class="vis-fechar" aria-label="Fechar">✕</button>
    <button class="vis-nav vis-ant" aria-label="Anterior">‹</button>
    <figure><img alt=""><figcaption></figcaption></figure>
    <button class="vis-nav vis-prox" aria-label="Próxima">›</button>
    <div class="vis-cont"></div>`;
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
  const img = el.querySelector('img');

  const mostrar = async () => {
    const f = fotos[i];
    img.src = cache[f.id] || f.thumb;
    img.classList.toggle('carregando', !cache[f.id]);
    el.querySelector('figcaption').textContent = f.legenda || '';
    el.querySelector('.vis-cont').textContent = `${i + 1} / ${fotos.length}`;
    if (!cache[f.id]) {
      const full = await carregarFull(f.id).catch(() => null);
      cache[f.id] = full || f.thumb;
      if (fotos[i].id === f.id) { img.src = cache[f.id]; img.classList.remove('carregando'); }
    }
  };
  const ir = (n) => { i = (i + n + fotos.length) % fotos.length; mostrar(); };
  const fechar = () => { el.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); if (e.key === 'ArrowLeft') ir(-1); if (e.key === 'ArrowRight') ir(1); };

  el.querySelector('.vis-fechar').onclick = fechar;
  el.querySelector('.vis-ant').onclick = () => ir(-1);
  el.querySelector('.vis-prox').onclick = () => ir(1);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.tagName === 'FIGURE') fechar(); });
  document.addEventListener('keydown', tecla);
  // deslizar no celular
  let x0 = null;
  el.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  el.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1); x0 = null; });
  if (fotos.length < 2) el.querySelectorAll('.vis-nav').forEach((b) => (b.style.display = 'none'));
  mostrar();
}
