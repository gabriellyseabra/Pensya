import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

interface ExtracaoPdf {
  html: string;
  imagens: { id: string; base64: string; largura?: number; altura?: number }[];
}

export async function extrairPdfParaHtml(arquivo: File): Promise<ExtracaoPdf> {
  const arrayBuffer = await arquivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  let htmlConteudo = '';
  const imagens: ExtracaoPdf['imagens'] = [];
  let imagemCounter = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    // ----- Texto (vira HTML editável) -----
    const textContent = await page.getTextContent();
    let paginaTexto = '';
    let ultimaY: number | null = null;

    for (const item of textContent.items) {
      const text = 'str' in item ? item.str : '';
      const y = 'transform' in item ? item.transform[5] : 0;

      if (ultimaY !== null && Math.abs(y - ultimaY) > 5 && paginaTexto.trim()) {
        paginaTexto += '\n';
      }
      paginaTexto += text + ' ';
      ultimaY = y;
    }

    if (paginaTexto.trim()) {
      const paragrafos = paginaTexto
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('\n');
      htmlConteudo += paragrafos;
      if (i < pdf.numPages) {
        htmlConteudo += '\n<hr style="border:none;border-top:1px solid #ccc;margin:20px 0;" />\n';
      }
    }

    // ----- Imagens embutidas (logo, fotos etc.) -----
    try {
      const extraidas = await extrairImagensEmbutidas(page);
      for (const base64 of extraidas) {
        imagens.push({ id: `pdf-imagem-${imagemCounter++}`, base64 });
      }
    } catch {
      // Falha silenciosa: PDF sem imagens ou formato não suportado.
    }
  }

  return {
    html: htmlConteudo || '<p>Nenhum conteúdo extraído do PDF.</p>',
    imagens,
  };
}

/**
 * Extrai as imagens embutidas (XObjects) de uma página, decodificando-as para
 * PNG em base64. Renderiza a página num canvas descartável apenas para forçar
 * o pdf.js a resolver os objetos de imagem — o resultado da renderização não é
 * usado, evitando duplicar o texto no HTML.
 */
async function extrairImagensEmbutidas(page: any): Promise<string[]> {
  const ops = await page.getOperatorList();
  const nomes: string[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
      const nome = ops.argsArray[i]?.[0];
      if (typeof nome === 'string') nomes.push(nome);
    }
  }
  if (nomes.length === 0) return [];

  // Renderização descartável para garantir que page.objs resolva as imagens.
  const viewport = page.getViewport({ scale: 1 });
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(1, Math.floor(viewport.width));
  scratch.height = Math.max(1, Math.floor(viewport.height));
  const scratchCtx = scratch.getContext('2d');
  if (scratchCtx) {
    await page.render({ canvasContext: scratchCtx, viewport }).promise;
  }

  const out: string[] = [];
  for (const nome of nomes) {
    try {
      const img = page.objs.has(nome) ? page.objs.get(nome) : null;
      const dataUrl = imagemParaDataUrl(img);
      if (dataUrl) out.push(dataUrl);
    } catch {
      // Ignora imagem que não pôde ser decodificada.
    }
  }
  return out;
}

/** Converte um objeto de imagem do pdf.js (bitmap ou raw data) em PNG base64. */
function imagemParaDataUrl(img: any): string | null {
  if (!img) return null;
  const w = img.width;
  const h = img.height;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (img.bitmap) {
    // pdf.js já decodificou para ImageBitmap — basta desenhar.
    ctx.drawImage(img.bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  }

  if (img.data) {
    const imageData = ctx.createImageData(w, h);
    const dst = imageData.data;
    const src = img.data as Uint8ClampedArray;
    // ImageKind: 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
    if (img.kind === 3 || src.length === w * h * 4) {
      dst.set(src.subarray(0, dst.length));
    } else if (img.kind === 2 || src.length === w * h * 3) {
      for (let s = 0, d = 0; d < dst.length; s += 3, d += 4) {
        dst[d] = src[s];
        dst[d + 1] = src[s + 1];
        dst[d + 2] = src[s + 2];
        dst[d + 3] = 255;
      }
    } else {
      return null; // Formato não suportado (ex.: grayscale 1bpp empacotado).
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  return null;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
