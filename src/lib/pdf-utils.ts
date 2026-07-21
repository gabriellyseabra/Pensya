import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ExtracaoPdf {
  html: string;
  imagens: { id: string; base64: string; largura?: number; altura?: number }[];
}

export async function extrairPdfParaHtml(arquivo: File): Promise<ExtracaoPdf> {
  const arrayBuffer = await arquivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

  let htmlConteudo = '';
  const imagens: ExtracaoPdf['imagens'] = [];
  let imagemCounter = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const operatorList = await page.getOperatorList();

    let paginaTexto = '';
    let ultimaY = null;

    for (const item of textContent.items) {
      const text = 'str' in item ? item.str : '';
      const y = 'y' in item ? item.y : 0;

      if (ultimaY !== null && Math.abs(y - ultimaY) > 5) {
        paginaTexto += '<br />';
      }

      paginaTexto += text + ' ';
      ultimaY = y;
    }

    if (paginaTexto.trim()) {
      const paragrafos = paginaTexto
        .split('\n')
        .filter((p) => p.trim())
        .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
        .join('\n');
      htmlConteudo += paragrafos;
      if (i < pdf.numPages) {
        htmlConteudo += '<hr style="border:none;border-top:1px solid #ccc;margin:20px 0;" />';
      }
    }

    // Extrai imagens da página
    try {
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const imageData = canvas.toDataURL('image/png');
        const imagemId = `pdf-imagem-${imagemCounter++}`;
        imagens.push({
          id: imagemId,
          base64: imageData,
          largura: Math.round(viewport.width),
          altura: Math.round(viewport.height),
        });
      }
    } catch (e) {
      // Falha silenciosa se não conseguir extrair imagem
    }
  }

  return {
    html: htmlConteudo || '<p>Nenhum conteúdo extraído do PDF.</p>',
    imagens,
  };
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
