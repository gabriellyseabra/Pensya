import { supabase } from "@/integrations/supabase/client";
import { minhaOrganizacaoLogoDataUrl, getMinhaOrganizacao } from "@/lib/clinica-config";

// Documento HTML personalizado do Plano Terapêutico, para impressão/PDF —
// aberto em nova janela, com a identidade da clínica (logo/nome) embutida.

function esc(v: any): string {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function nl2br(v: any): string {
  return esc(v).replace(/\n/g, "<br>");
}
function fmtData(d: any): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return String(d); }
}
function idadeDe(dn: any): string {
  if (!dn) return "";
  const anos = Math.floor((Date.now() - new Date(dn).getTime()) / 31557600000);
  return Number.isFinite(anos) ? `${anos} anos` : "";
}

const CAT_LABEL: Record<string, string> = {
  restricao_participacao: "Restrições de participação",
  limitacao_atividade: "Limitações de atividade",
  funcao_relacionada: "Funções relacionadas (hipóteses)",
  fator_ambiental: "Fatores ambientais",
  fator_pessoal: "Fatores pessoais",
};
const CAT_ORDER = ["restricao_participacao", "limitacao_atividade", "funcao_relacionada", "fator_ambiental", "fator_pessoal"];
const CONF_LABEL: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
const GAS_LABEL: Record<number, string> = {
  [-2]: "−2 Regressão/estagnação", [-1]: "−1 Progresso insuficiente",
  0: "0 Resultado esperado (meta)", 1: "+1 Acima do esperado", 2: "+2 Generalização",
};

export async function gerarPlanoDocumentoHTML(planoId: string): Promise<string> {
  const [{ data: plano }, logo, clinicaCfg] = await Promise.all([
    supabase
      .from("planos_terapeuticos")
      .select("*, paciente:pacientes(nome, data_nascimento, escolaridade, serie_curso)")
      .eq("id", planoId)
      .single(),
    minhaOrganizacaoLogoDataUrl(),
    getMinhaOrganizacao(),
  ]);
  if (!plano) throw new Error("Plano não encontrado");
  const nomeClinica = clinicaCfg?.nome?.trim() || "";

  const [{ data: formulacao }, { data: objetivos }, { data: metas }] = await Promise.all([
    supabase.from("plano_formulacao_itens").select("*").eq("plano_id", planoId).order("categoria").order("ordem"),
    supabase.from("plano_objetivos").select("*").eq("plano_id", planoId).order("ordem"),
    supabase.from("plano_metas").select("*, plano_gas(nivel, descricao), plano_meta_componentes(nome, ordem)").eq("plano_id", planoId).order("ordem"),
  ]);

  const rac = (plano as any).raciocinio_clinico ?? {};
  const pac = (plano as any).paciente ?? {};

  // ---- Formulação por categoria ----
  const formPorCat = new Map<string, any[]>();
  for (const it of (formulacao ?? [])) {
    const arr = formPorCat.get(it.categoria) ?? [];
    arr.push(it);
    formPorCat.set(it.categoria, arr);
  }
  const formulacaoHTML = CAT_ORDER.filter((c) => (formPorCat.get(c) ?? []).length).map((c) => {
    const itens = (formPorCat.get(c) ?? []).slice().sort((a, b) => (a.prioridade ?? 99) - (b.prioridade ?? 99) || a.ordem - b.ordem);
    const lis = itens.map((it) => {
      const tags: string[] = [];
      if (it.prioridade != null) tags.push(`Prioridade ${it.prioridade}`);
      if (it.impacto) tags.push(`impacto ${esc(it.impacto)}`);
      if (it.confianca) tags.push(`confiança ${CONF_LABEL[it.confianca] ?? it.confianca}`);
      return `<li>${esc(it.descricao)}${tags.length ? ` <span class="tag">${tags.join(" · ")}</span>` : ""}</li>`;
    }).join("");
    return `<div class="formblock"><h3>${CAT_LABEL[c]}</h3><ul>${lis}</ul></div>`;
  }).join("");

  // ---- Priorização ----
  const prio = Array.isArray(rac.priorizacao) ? rac.priorizacao : [];
  const priorizacaoHTML = prio.length
    ? `<ol>${prio.slice().sort((a: any, b: any) => (a.ordem ?? 99) - (b.ordem ?? 99)).map((p: any) => `<li><strong>${esc(p.area ?? "—")}</strong>${p.racional ? ` — ${esc(p.racional)}` : ""}</li>`).join("")}</ol>`
    : "";

  // ---- Objetivos + metas ----
  const metasArr = (metas ?? []) as any[];
  const metaHTML = (m: any): string => {
    const comps = (m.plano_meta_componentes ?? []).slice().sort((a: any, b: any) => a.ordem - b.ordem).map((c: any) => esc(c.nome));
    const gasMap = new Map<number, string>();
    (m.plano_gas ?? []).forEach((g: any) => gasMap.set(g.nivel, g.descricao));
    const gasRows = [2, 1, 0, -1, -2].map((n) => `<tr><td class="gaslvl n${n < 0 ? "neg" + Math.abs(n) : "p" + n}">${GAS_LABEL[n]}</td><td>${esc(gasMap.get(n) ?? "—")}</td></tr>`).join("");

    return `<div class="meta">
      <div class="meta-titulo">${esc(m.titulo_smart)}${m.grau_confianca ? ` <span class="badge">confiança ${CONF_LABEL[m.grau_confianca] ?? m.grau_confianca}</span>` : ""}</div>
      <table class="kv">
        ${m.dominio ? `<tr><th>Domínio</th><td>${esc(m.dominio)}</td></tr>` : ""}
        ${m.restricao_funcional ? `<tr><th>Restrição funcional</th><td>${nl2br(m.restricao_funcional)}</td></tr>` : ""}
        ${m.baseline ? `<tr><th>Baseline</th><td>${nl2br(m.baseline)}</td></tr>` : ""}
        ${comps.length ? `<tr><th>Componentes clínicos</th><td>${comps.join(", ")}</td></tr>` : ""}
        ${m.grau_confianca === "baixa" && m.confianca_justificativa ? `<tr><th>Observação de confiança</th><td>${nl2br(m.confianca_justificativa)}</td></tr>` : ""}
        ${m.justificativa ? `<tr><th>Justificativa clínica</th><td>${nl2br(m.justificativa)}</td></tr>` : ""}
      </table>
      <div class="sub"><div class="sub-t">Escala GAS</div><table class="gas">${gasRows}</table></div>
    </div>`;
  };

  const semObjetivo = metasArr.filter((m) => !m.objetivo_id);
  const objetivosHTML = [
    ...(objetivos ?? []).map((o: any) => {
      const suas = metasArr.filter((m) => m.objetivo_id === o.id);
      if (!suas.length && !o.descricao) return "";
      return `<div class="objetivo">
        <h3 class="obj-t">${esc(o.titulo)}${o.dominio_funcional ? ` <span class="tag">${esc(o.dominio_funcional)}</span>` : ""}</h3>
        ${o.descricao ? `<p class="obj-d">${nl2br(o.descricao)}</p>` : ""}
        ${suas.map(metaHTML).join("")}
      </div>`;
    }),
    semObjetivo.length ? `<div class="objetivo"><h3 class="obj-t">Metas</h3>${semObjetivo.map(metaHTML).join("")}</div>` : "",
  ].join("");

  const cifLegado = ["cif_funcoes", "cif_atividades", "cif_participacao", "cif_ambientais", "cif_pessoais"].some((k) => ((plano as any)[k] ?? "").trim?.());

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Plano Terapêutico — ${esc(pac.nome ?? "")}</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  :root { --petroleo:#1b4f72; --rose:#c9a0b5; --rose-bg:#faf6f9; --ink:#243040; --muted:#6b7280; --line:#e7e2e6; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; }
  body { font-family: "Segoe UI", -apple-system, Roboto, Arial, sans-serif; color: var(--ink); font-size: 12px; line-height: 1.55; }
  h1 { font-size: 21px; margin: 0; color: var(--petroleo); letter-spacing:.2px; }
  h2 { font-size: 13.5px; text-transform: uppercase; letter-spacing:.6px; margin: 22px 0 8px; color: var(--petroleo); border-bottom: 2px solid var(--rose); padding-bottom: 4px; break-after: avoid; }
  h3 { font-size: 12.5px; margin: 10px 0 4px; color: #33414f; break-after: avoid; }
  p { margin: 4px 0; }
  ul, ol { margin: 4px 0; padding-left: 18px; }
  li { margin: 2px 0; }
  .tag { display:inline-block; font-size: 10px; color: var(--petroleo); background: var(--rose-bg); border:1px solid var(--rose); border-radius: 10px; padding: 0 7px; }
  .badge { display:inline-block; font-size: 10px; color:#fff; background: var(--rose); border-radius: 10px; padding: 1px 8px; vertical-align: middle; }
  .muted { color: var(--muted); }

  .header { display:flex; align-items:center; gap:16px; border-bottom: 3px solid var(--petroleo); padding-bottom: 12px; }
  .header .logo { height: 46px; width:auto; }
  .header .title { flex:1; }
  .header .title .sub { color: var(--muted); font-size: 11px; margin-top: 2px; }
  .paciente { text-align:right; font-size: 11px; color: var(--ink); }
  .paciente .nome { font-weight: 700; color: var(--petroleo); font-size: 13px; }

  table.info { width:100%; border-collapse: collapse; }
  table.info td { padding: 3px 0; vertical-align: top; }

  .formblock { break-inside: avoid; }

  .objetivo { margin: 12px 0; }
  .obj-t { background: var(--rose-bg); border-left: 4px solid var(--rose); padding: 6px 10px; border-radius: 4px; color: var(--petroleo); }
  .obj-d { color: var(--muted); margin: 4px 0 6px; }

  .meta { margin: 8px 0 10px; padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; background:#fff; break-inside: avoid; page-break-inside: avoid; }
  .meta-titulo { font-weight: 700; color: var(--petroleo); margin-bottom: 5px; }
  table.kv { width:100%; border-collapse: collapse; margin: 2px 0 6px; }
  table.kv th { text-align:left; width: 150px; vertical-align: top; color:#3b4653; font-weight: 600; padding: 2px 10px 2px 0; }
  table.kv td { vertical-align: top; padding: 2px 0; }
  .sub-t { font-weight: 700; color:#3b4653; font-size: 11px; margin-bottom: 2px; }
  table.gas { width:100%; border-collapse: collapse; break-inside: avoid; }
  table.gas td { border: 1px solid var(--line); padding: 4px 7px; vertical-align: top; }
  table.gas .gaslvl { width: 190px; font-weight: 600; }
  .gaslvl.nneg2 { background:#fdecef; } .gaslvl.nneg1 { background:#fdf3e8; }
  .gaslvl.n0 { background:#eaf1f7; } .gaslvl.n1 { background:#eaf7f0; } .gaslvl.n2 { background:#e8f6f4; }

  .footer { margin-top: 22px; border-top: 1px solid var(--line); padding-top: 6px; color:#9aa2ad; font-size: 10px; display:flex; justify-content: space-between; }
</style></head>
<body>
  <div class="header">
    ${logo ? `<img class="logo" src="${logo}" alt="${esc(nomeClinica)}">` : ""}
    <div class="title">
      <h1>Plano Terapêutico</h1>
      <div class="sub">${esc((plano as any).titulo ?? "")}</div>
    </div>
    <div class="paciente">
      <div class="nome">${esc(pac.nome ?? "—")}</div>
      <div>${[idadeDe(pac.data_nascimento), esc(pac.escolaridade ?? ""), esc(pac.serie_curso ?? "")].filter(Boolean).join(" · ")}</div>
    </div>
  </div>

  <h2>Contexto clínico</h2>
  <table class="info">
    <tr><td><strong>Queixa principal:</strong> ${nl2br((plano as any).queixa_principal || "—")}</td></tr>
    <tr><td><strong>Hipótese diagnóstica:</strong> ${nl2br((plano as any).diagnostico_resumo || "—")}</td></tr>
    <tr><td><strong>Medicação:</strong> ${esc((plano as any).medicacao || "—")} &nbsp;·&nbsp; <strong>Frequência:</strong> ${esc((plano as any).frequencia_sessoes || "—")}</td></tr>
    <tr><td><strong>Início:</strong> ${fmtData((plano as any).data_inicio)} &nbsp;·&nbsp; <strong>Revisão prevista:</strong> ${fmtData((plano as any).data_revisao_prevista)}</td></tr>
    ${(plano as any).objetivo_participacao ? `<tr><td><strong>Objetivo de participação:</strong> ${nl2br((plano as any).objetivo_participacao)}</td></tr>` : ""}
  </table>

  ${formulacaoHTML ? `<h2>Formulação clínica (CIF)</h2>${formulacaoHTML}` : ""}
  ${!formulacaoHTML && cifLegado ? `<h2>Perfil CIF</h2>
    ${(plano as any).cif_funcoes ? `<h3>Funções e estruturas</h3><p>${nl2br((plano as any).cif_funcoes)}</p>` : ""}
    ${(plano as any).cif_atividades ? `<h3>Atividades</h3><p>${nl2br((plano as any).cif_atividades)}</p>` : ""}
    ${(plano as any).cif_participacao ? `<h3>Participação</h3><p>${nl2br((plano as any).cif_participacao)}</p>` : ""}
    ${(plano as any).cif_ambientais ? `<h3>Fatores ambientais</h3><p>${nl2br((plano as any).cif_ambientais)}</p>` : ""}
    ${(plano as any).cif_pessoais ? `<h3>Fatores pessoais</h3><p>${nl2br((plano as any).cif_pessoais)}</p>` : ""}` : ""}

  ${rac.sintese ? `<h2>Síntese do raciocínio clínico</h2><p>${nl2br(rac.sintese)}</p>` : ""}
  ${priorizacaoHTML ? `<h2>Priorização</h2>${priorizacaoHTML}` : ""}

  ${objetivosHTML.trim() ? `<h2>Objetivos e metas</h2>${objetivosHTML}` : ""}

  ${((plano as any).orientacoes_familia || (plano as any).orientacoes_escola || (plano as any).parceiros_clinicos) ? `<h2>Orientações</h2>
    ${(plano as any).orientacoes_familia ? `<h3>Família</h3><p>${nl2br((plano as any).orientacoes_familia)}</p>` : ""}
    ${(plano as any).orientacoes_escola ? `<h3>Escola</h3><p>${nl2br((plano as any).orientacoes_escola)}</p>` : ""}
    ${(plano as any).parceiros_clinicos ? `<h3>Parceiros clínicos / articulações</h3><p>${nl2br((plano as any).parceiros_clinicos)}</p>` : ""}` : ""}

  <div class="footer">
    <span>${esc(nomeClinica)}</span>
    <span>Emitido em ${new Date().toLocaleDateString("pt-BR")}</span>
  </div>
  <script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`;
}

/** Abre a janela de impressão do documento do plano (pop-up síncrono + preenchimento assíncrono). */
export async function imprimirPlano(planoId: string): Promise<void> {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) throw new Error("Permita pop-ups para gerar o PDF do plano.");
  w.document.write("<!doctype html><html><body style='font-family:sans-serif;padding:40px;color:#555'>Gerando documento do plano…</body></html>");
  try {
    const html = await gerarPlanoDocumentoHTML(planoId);
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch (e: any) {
    w.document.open();
    w.document.write(`<!doctype html><html><body style='font-family:sans-serif;padding:40px;color:#b00'>Falha ao gerar o documento: ${esc(e?.message ?? e)}</body></html>`);
    w.document.close();
    throw e;
  }
}
