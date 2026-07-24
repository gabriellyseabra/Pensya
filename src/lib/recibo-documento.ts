import { jsPDF } from "jspdf";
import { minhaOrganizacaoLogoDataUrl, type Organizacao } from "@/lib/clinica-config";

/**
 * Gerador de PDF de recibo (recibo simples e recibo de serviço de saúde,
 * este último com o registro do prestador para dedução no IRPF / Receita
 * Saúde). Não usa nenhum material de terceiros — layout próprio em jsPDF.
 */

export type ReciboTipo = "recibo" | "recibo_saude";

export type ReciboOpts = {
  tipo: ReciboTipo;
  pacienteNome?: string | null;
  tomadorNome: string;
  tomadorDocumento?: string | null;
  valor: number;
  data: string; // ISO yyyy-mm-dd
  descricao?: string | null;
  org: Organizacao | null;
};

/* ============================ valor por extenso ============================ */

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

/** Escreve por extenso um número de 0 a 999. */
function ateNovecentos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

/** Escreve por extenso um inteiro de 0 até 999.999.999. */
function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const centenas = n % 1000;
  const partes: string[] = [];
  if (milhoes > 0) partes.push(milhoes === 1 ? "um milhão" : `${ateNovecentos(milhoes)} milhões`);
  if (milhares > 0) partes.push(milhares === 1 ? "mil" : `${ateNovecentos(milhares)} mil`);
  if (centenas > 0) partes.push(ateNovecentos(centenas));
  return partes.join(" e ");
}

/** Valor monetário (R$) por extenso em pt-BR, com reais e centavos. */
export function valorPorExtenso(n: number): string {
  const negativo = n < 0;
  const abs = Math.abs(Math.round(n * 100) / 100);
  const reais = Math.floor(abs);
  const centavos = Math.round((abs - reais) * 100);

  const partes: string[] = [];
  if (reais > 0) {
    partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  if (partes.length === 0) return "zero real";
  const texto = partes.join(" e ");
  return negativo ? `menos ${texto}` : texto;
}

/* ================================ helpers ================================ */

const BRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dataExtenso(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

/* ================================= PDF ================================= */

/** Gera o PDF do recibo e devolve como Blob. */
export async function gerarReciboPdf(opts: ReciboOpts): Promise<Blob> {
  const { tipo, pacienteNome, tomadorNome, tomadorDocumento, valor, data, descricao, org } = opts;
  const logo = await minhaOrganizacaoLogoDataUrl();

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  const contentW = pageWidth - marginX * 2;
  let y = 54;

  const nomeClinica = org?.nome ?? org?.razao_social ?? "Clínica";
  const cidade = org?.cidade ?? "";

  // ---- Cabeçalho: logo + dados da clínica ----
  if (logo) {
    try {
      doc.addImage(logo, "PNG", marginX, y, 54, 54);
    } catch {
      /* logo inválido — segue sem imagem */
    }
  }
  const headerX = logo ? marginX + 68 : marginX;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(nomeClinica, headerX, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let hy = y + 32;
  const infoLinhas: string[] = [];
  if (org?.cnpj) infoLinhas.push(`CNPJ: ${org.cnpj}`);
  if (org?.inscricao_municipal) infoLinhas.push(`Inscrição municipal: ${org.inscricao_municipal}`);
  if (org?.endereco) infoLinhas.push(org.endereco);
  for (const linha of infoLinhas) {
    doc.text(linha, headerX, hy);
    hy += 12;
  }
  y = Math.max(y + 66, hy + 6);

  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 30;

  // ---- Título ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titulo = tipo === "recibo_saude" ? "RECIBO — SERVIÇO DE SAÚDE" : "RECIBO";
  doc.text(titulo, pageWidth / 2, y, { align: "center" });
  y += 16;

  // Valor em destaque
  doc.setFontSize(13);
  doc.text(BRL(valor), pageWidth / 2, y, { align: "center" });
  y += 32;

  // ---- Corpo ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const docTxt = tomadorDocumento ? ` (CPF/CNPJ ${tomadorDocumento})` : "";
  const refTxt = descricao && descricao.trim() ? descricao.trim() : "serviços prestados";
  const corpo =
    `Recebi de ${tomadorNome}${docTxt} a importância de ${BRL(valor)} ` +
    `(${valorPorExtenso(valor)}) referente a ${refTxt}.`;
  const linhasCorpo = doc.splitTextToSize(corpo, contentW);
  doc.text(linhasCorpo, marginX, y);
  y += linhasCorpo.length * 16 + 6;

  if (pacienteNome) {
    const pacTxt = doc.splitTextToSize(`Paciente atendido: ${pacienteNome}.`, contentW);
    doc.text(pacTxt, marginX, y);
    y += pacTxt.length * 16 + 2;
  }

  // Bloco específico do recibo de saúde
  if (tipo === "recibo_saude") {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const saudeTitulo = doc.splitTextToSize(`Serviço de saúde — ${refTxt}`, contentW);
    doc.text(saudeTitulo, marginX, y);
    y += saudeTitulo.length * 14 + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    if (org?.prestador_registro) {
      doc.text(`Registro do prestador: ${org.prestador_registro}`, marginX, y);
      y += 13;
    }
    const nota = doc.splitTextToSize(
      "Documento hábil para comprovação de despesa com saúde perante a Receita Federal (dedução no IRPF / Receita Saúde).",
      contentW,
    );
    doc.text(nota, marginX, y);
    y += nota.length * 12 + 6;
  }

  // ---- Local e data ----
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const localData = `${cidade ? cidade + ", " : ""}${dataExtenso(data)}.`;
  doc.text(localData, marginX, y);

  // ---- Assinatura ----
  y += 70;
  const linhaW = 260;
  const cx = pageWidth / 2;
  doc.setDrawColor(60);
  doc.line(cx - linhaW / 2, y, cx + linhaW / 2, y);
  y += 14;
  doc.setFontSize(11);
  doc.text(nomeClinica, cx, y, { align: "center" });
  if (org?.cnpj) {
    y += 13;
    doc.setFontSize(9);
    doc.text(`CNPJ ${org.cnpj}`, cx, y, { align: "center" });
  }

  return doc.output("blob");
}
