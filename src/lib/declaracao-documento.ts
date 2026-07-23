import { renderContratoHtml } from "@/lib/contratos";
import { getMinhaOrganizacao, minhaOrganizacaoLogoDataUrl } from "@/lib/clinica-config";

/**
 * Declaração de comparecimento — documento simples, editável pela clínica.
 * Reaproveita o motor de variáveis {{...}} dos contratos e o logo em data-URL
 * (para sobreviver ao print/PDF). Não usa nenhum material de terceiros.
 */

export const MODELO_DECLARACAO_PADRAO = `<p>Declaro, para os devidos fins, que <strong>{{paciente.nome}}</strong> compareceu a atendimento nesta clínica no dia <strong>{{data}}</strong>, no horário das <strong>{{hora_inicio}}</strong> às <strong>{{hora_fim}}</strong>{{profissional_frase}}.</p>
<p>Por ser expressão da verdade, firmo a presente declaração.</p>`;

export type DadosDeclaracao = {
  pacienteNome: string;
  data: string;        // ISO yyyy-mm-dd
  horaInicio: string;  // HH:mm
  horaFim: string;     // HH:mm
  profissionalNome?: string | null;
  modelo?: string;     // corpo editável (HTML com {{vars}}); usa o padrão se vazio
};

function dataExtenso(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function gerarDeclaracaoHTML(dados: DadosDeclaracao): Promise<{ titulo: string; html: string }> {
  const [org, logo] = await Promise.all([getMinhaOrganizacao(), minhaOrganizacaoLogoDataUrl()]);
  const nomeClinica = org?.nome ?? "Clínica";
  const cidade = org?.cidade ?? "";

  const vars: Record<string, unknown> = {
    paciente: { nome: dados.pacienteNome },
    data: dataExtenso(dados.data),
    hora_inicio: dados.horaInicio,
    hora_fim: dados.horaFim,
    profissional: dados.profissionalNome ?? "",
    profissional_frase: dados.profissionalNome ? `, com ${dados.profissionalNome}` : "",
    clinica: { nome: nomeClinica, cnpj: org?.cnpj ?? "", endereco: org?.endereco ?? "" },
    cidade,
    data_hoje: new Date().toLocaleDateString("pt-BR"),
  };

  const corpo = renderContratoHtml(dados.modelo || MODELO_DECLARACAO_PADRAO, vars);
  const localData = `${cidade ? esc(cidade) + ", " : ""}${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Declaração de comparecimento</title>
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
  @media print { .noprint { display:none; } }
</style></head>
<body>
  <div class="cab">
    ${logo ? `<img src="${logo}" alt="${esc(nomeClinica)}">` : ""}
    <div class="nome">${esc(nomeClinica)}</div>
  </div>
  <h1>Declaração de comparecimento</h1>
  <div class="corpo">${corpo}</div>
  <p class="local">${localData}.</p>
  <div class="assin">
    <div class="linha"></div>
    <div>${esc(nomeClinica)}</div>
  </div>
  <div class="rodape">${esc(nomeClinica)}${org?.cnpj ? " · CNPJ " + esc(org.cnpj) : ""}${org?.endereco ? " · " + esc(org.endereco) : ""}</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;

  return { titulo: `Declaração de comparecimento — ${dados.pacienteNome}`, html };
}

export function imprimirDeclaracao(html: string) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
