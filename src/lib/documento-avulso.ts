import { getMinhaOrganizacao, minhaOrganizacaoLogoDataUrl } from "@/lib/clinica-config";

/**
 * Gerador genérico de documentos avulsos (declaração, atestado, encaminhamento,
 * autorização, parecer…) em HTML pronto para imprimir / salvar em PDF, com o
 * cabeçalho e o rodapé da clínica. Layout próprio — sem material de terceiros.
 */

const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Converte texto simples (parágrafos separados por linha em branco) em HTML. */
export function textoParaHtml(texto: string): string {
  return (texto ?? "")
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function gerarDocumentoHTML(opts: {
  titulo: string;
  corpoHtml: string;
  assinaturaNome?: string | null;
}): Promise<string> {
  const [org, logo] = await Promise.all([getMinhaOrganizacao(), minhaOrganizacaoLogoDataUrl()]);
  const nomeClinica = org?.nome ?? "Clínica";
  const cidade = org?.cidade ?? "";
  const assinante = opts.assinaturaNome || nomeClinica;
  const localData = `${cidade ? esc(cidade) + ", " : ""}${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(opts.titulo)}</title>
<style>
  @page { size: A4; margin: 22mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1f2937; line-height: 1.7; font-size: 15px; }
  .cab { display:flex; align-items:center; gap:16px; border-bottom:2px solid #e5e7eb; padding-bottom:14px; margin-bottom:28px; }
  .cab img { height:56px; width:auto; object-fit:contain; }
  .cab .nome { font-size:18px; font-weight:700; color:#111827; }
  h1 { font-size:20px; text-align:center; letter-spacing:.5px; margin:8px 0 28px; text-transform:uppercase; }
  .corpo p { margin:0 0 14px; text-align:justify; }
  .local { margin-top:40px; }
  .assin { margin-top:64px; text-align:center; }
  .assin .linha { border-top:1px solid #374151; width:280px; margin:0 auto 6px; }
  .rodape { margin-top:48px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:11px; color:#6b7280; text-align:center; }
</style></head>
<body>
  <div class="cab">
    ${logo ? `<img src="${logo}" alt="${esc(nomeClinica)}">` : ""}
    <div class="nome">${esc(nomeClinica)}</div>
  </div>
  <h1>${esc(opts.titulo)}</h1>
  <div class="corpo">${opts.corpoHtml}</div>
  <p class="local">${localData}.</p>
  <div class="assin">
    <div class="linha"></div>
    <div>${esc(assinante)}</div>
  </div>
  <div class="rodape">${esc(nomeClinica)}${org?.cnpj ? " · CNPJ " + esc(org.cnpj) : ""}${org?.endereco ? " · " + esc(org.endereco) : ""}</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;
}

export function imprimirDocumento(html: string) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
