import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function extrairPdfParaHtml(arquivo: File): Promise<string> {
  const arrayBuffer = await arquivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

  let htmlConteudo = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    let paginaTexto = '';
    let ultimaY = null;

    for (const item of textContent.items) {
      const text = 'str' in item ? item.str : '';
      const y = 'y' in item ? item.y : 0;

      // Detecta quebra de linha (mudança significativa em Y)
      if (ultimaY !== null && Math.abs(y - ultimaY) > 5) {
        paginaTexto += '<br />';
      }

      paginaTexto += text + ' ';
      ultimaY = y;
    }

    // Converte para parágrafos separados por quebras duplas
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
  }

  return htmlConteudo || '<p>Nenhum conteúdo extraído do PDF.</p>';
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
