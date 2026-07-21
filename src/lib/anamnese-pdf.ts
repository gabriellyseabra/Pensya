import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ANAMNESE_SECOES, type SecaoDef } from "@/lib/anamnese-schema";

interface AnamnesePDFInput {
  pacienteNome: string;
  pacienteIdade?: number | null;
  pacienteNascimento?: string | null;
  secoes: Record<string, Record<string, any>>;
  resumos?: Record<string, string>;
  geradoEm?: string;
}

function formatarValor(v: any): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

function rotuloCampo(def: SecaoDef, key: string): string {
  return def.campos.find((c) => c.key === key)?.label ?? key;
}

export function exportarAnamnesePDF({
  pacienteNome,
  pacienteIdade,
  pacienteNascimento,
  secoes,
  resumos,
  geradoEm,
}: AnamnesePDFInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Anamnese Clínica", marginX, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Paciente: ${pacienteNome}`, marginX, y); y += 14;
  if (pacienteNascimento || pacienteIdade != null) {
    const idadeTxt = pacienteIdade != null ? ` · ${pacienteIdade} anos` : "";
    doc.text(`Nascimento: ${pacienteNascimento ?? "—"}${idadeTxt}`, marginX, y); y += 14;
  }
  doc.text(`Gerado em: ${geradoEm ?? new Date().toLocaleString("pt-BR")}`, marginX, y); y += 16;

  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 14;

  // Seções
  for (const def of ANAMNESE_SECOES) {
    const dados = secoes[def.key] ?? {};
    const linhas = Object.entries(dados)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => [rotuloCampo(def, k), formatarValor(v)]);

    if (linhas.length === 0 && !resumos?.[def.key]) continue;

    if (y > 740) { doc.addPage(); y = 50; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(def.titulo, marginX, y);
    y += 8;

    if (linhas.length > 0) {
      autoTable(doc, {
        startY: y + 4,
        head: [["Campo", "Resposta"]],
        body: linhas,
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 9, cellPadding: 4, valign: "top" },
        headStyles: { fillColor: [240, 240, 245], textColor: 60 },
        columnStyles: { 0: { cellWidth: 160, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
        theme: "grid",
      });
      // @ts-ignore — jspdf-autotable sets lastAutoTable
      y = (doc as any).lastAutoTable.finalY + 14;
    } else {
      y += 14;
    }

    if (resumos?.[def.key]) {
      if (y > 740) { doc.addPage(); y = 50; }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      const txt = doc.splitTextToSize(`Síntese: ${resumos[def.key]}`, pageWidth - marginX * 2);
      doc.text(txt, marginX, y);
      y += txt.length * 11 + 10;
    }
  }

  // Rodapé com numeração
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  const safeName = pacienteNome.replace(/[^a-zA-Z0-9-_]+/g, "_");
  doc.save(`anamnese_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
