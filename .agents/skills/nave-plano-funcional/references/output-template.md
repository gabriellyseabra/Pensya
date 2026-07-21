# Template de Output — HTML e PDF

## Paleta e Tipografia Nave

```
Petrol escuro:  #013a52  (cabeçalhos principais, fundo de seção)
Petrol:         #025073  (elementos primários, bordas de destaque)
Petrol médio:   #2a7a9a  (hover, gradientes)
Azul suave:     #568FA6  (labels secundários)
Azul pálido:    #C5DDE8  (bordas leves, backgrounds)
Rosé:           #C97A8A  (acentos, eyebrows, seções de destaque)
Rosé claro:     #F2D9DE  (backgrounds suaves de alerta)
Creme:          #F7F4F0  (background geral)
Branco:         #FFFFFF  (cards)
Tinta:          #1A2332  (texto principal)
Tinta suave:    #3D4F63  (texto secundário)
Borda:          #D8E4EA

GAS −2:  bg #FCEAEA  fg #8B1A1A
GAS −1:  bg #FDF3E0  fg #8B4A00
GAS  0:  bg #E0F0FA  fg #013a52
GAS +1:  bg #E4F5EF  fg #1A6040
GAS +2:  bg #CCEEE4  fg #0A4A30

Fonte: 'DM Sans', 'Segoe UI', system-ui, sans-serif
```

---

## Estrutura do HTML — Seções em Ordem

```
1. Topbar com logo Nave + botão impressão/PDF
2. Cabeçalho do documento (dados do paciente)
3. Síntese do Perfil CIF (tabela 5 componentes)
4. Objetivo de Participação ao final do ciclo
5. Para cada meta:
   a. Cabeçalho da meta (domínio, prazo, baseline)
   b. Tabela GAS com 5 níveis e cores
   c. Estratégias de intervenção
   d. Campo "Nível atingido ao final do ciclo" (para revisão)
6. Orientações para a Família
7. Orientações para a Escola
8. Parceiros clínicos e articulações
9. Campo de revisão do ciclo (data + observações)
10. Assinatura (profissional + responsável + datas)
```

---

## Template HTML base

Use este template como ponto de partida. Substitua os placeholders `{{...}}` com os dados do paciente.

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Plano Terapêutico — {{NOME_PACIENTE}}</title>
<style>
:root {
  --petrol: #025073; --petrol-dark: #013a52; --petrol-mid: #2a7a9a;
  --blue-pale: #C5DDE8; --rose: #C97A8A; --rose-light: #F2D9DE;
  --teal: #2D9B8A; --teal-light: #D4F0EB;
  --cream: #F7F4F0; --white: #FFFFFF; --ink: #1A2332; --ink-soft: #3D4F63;
  --border: #D8E4EA;
  --g-n2-bg:#FCEAEA; --g-n2-fg:#8B1A1A;
  --g-n1-bg:#FDF3E0; --g-n1-fg:#8B4A00;
  --g-0-bg:#E0F0FA;  --g-0-fg:#013a52;
  --g-p1-bg:#E4F5EF; --g-p1-fg:#1A6040;
  --g-p2-bg:#CCEEE4; --g-p2-fg:#0A4A30;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans','Segoe UI',system-ui,sans-serif; background: var(--cream); color: var(--ink); line-height: 1.6; }

/* TOPBAR */
.topbar { background: var(--petrol-dark); display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 50px; position: sticky; top: 0; z-index: 100; }
.t-logo { font-size: 13px; font-weight: 800; letter-spacing: 1.5px; color: #7ecae0; text-transform: uppercase; }
.t-title { font-size: 13px; color: rgba(255,255,255,0.55); }
.print-btn { padding: 6px 18px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; cursor: pointer; }
.print-btn:hover { background: rgba(255,255,255,0.1); color: white; }

/* MAIN */
.main { max-width: 860px; margin: 0 auto; padding: 32px 24px 80px; }

/* CARDS */
.card { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; margin-bottom: 16px; }
.card-header { background: var(--petrol); color: white; border-radius: 10px 10px 0 0; padding: 14px 20px; margin: -22px -24px 18px; }
.card-header h2 { font-size: 16px; font-weight: 700; color: white; margin: 0; }
.card-header span { font-size: 12px; color: rgba(255,255,255,0.65); }

/* INFO TABLE */
.info-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.info-table td { padding: 8px 0; border-bottom: 1px solid #EEF3F6; }
.info-table td:first-child { font-weight: 600; color: var(--petrol); width: 160px; }
.info-table tr:last-child td { border-bottom: none; }

/* CIF TABLE */
.cif-table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
.cif-table th { background: #EDF4F8; padding: 9px 13px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-soft); text-align: left; border-bottom: 1px solid var(--border); }
.cif-table td { padding: 11px 13px; border-bottom: 1px solid #EEF3F6; font-size: 13px; color: var(--ink-soft); vertical-align: top; }
.cif-table tr:last-child td { border-bottom: none; }
.cif-table td:first-child { font-weight: 700; color: var(--ink); width: 180px; }

/* META BLOCK */
.meta-block { background: white; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
.meta-block-header { background: var(--petrol); padding: 14px 20px; }
.meta-block-header h3 { font-size: 15px; font-weight: 700; color: white; margin-bottom: 4px; }
.meta-block-header .meta-sub { font-size: 12px; color: rgba(255,255,255,0.65); }
.baseline-bar { background: #FDF3E0; border-top: 1px solid var(--border); padding: 10px 18px; font-size: 12.5px; color: #7A4A10; border-bottom: 1px solid var(--border); }
.baseline-bar strong { color: #5A3010; }

/* GAS TABLE */
.gas-table { width: 100%; border-collapse: collapse; }
.gas-row { display: grid; grid-template-columns: 70px 1fr; border-bottom: 1px solid #EEF3F6; }
.gas-row:last-child { border-bottom: none; }
.gas-score { display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; padding: 12px 8px; gap: 2px; }
.gas-score small { font-size: 9px; font-weight: 600; text-transform: uppercase; }
.gas-desc { padding: 12px 16px; border-left: 1px solid #EEF3F6; font-size: 13px; color: var(--ink-soft); line-height: 1.65; }
.gas-desc.goal { background: #F2F9FD; font-weight: 600; color: var(--ink); }
.gsc-n2 { background: var(--g-n2-bg); color: var(--g-n2-fg); }
.gsc-n1 { background: var(--g-n1-bg); color: var(--g-n1-fg); }
.gsc-0  { background: var(--g-0-bg);  color: var(--g-0-fg);  }
.gsc-p1 { background: var(--g-p1-bg); color: var(--g-p1-fg); }
.gsc-p2 { background: var(--g-p2-bg); color: var(--g-p2-fg); }

/* SECTION */
.section-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--rose); margin-bottom: 6px; }
.section-h2 { font-size: 22px; font-weight: 800; color: var(--petrol); margin-bottom: 6px; }
.section-rule { height: 3px; width: 36px; background: var(--rose); border-radius: 2px; margin-bottom: 20px; }

/* STRAT */
.strat-item { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #EEF3F6; }
.strat-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.strat-name { font-size: 13.5px; font-weight: 700; color: var(--petrol); margin-bottom: 3px; }
.strat-why  { font-size: 13px; color: var(--ink-soft); line-height: 1.65; }

/* REVISÃO FIELD */
.revisao-field { border: 1.5px dashed var(--border); border-radius: 8px; padding: 14px 16px; min-height: 60px; font-size: 13px; color: var(--ink-soft); font-style: italic; }

/* PRINT */
@media print {
  .topbar, .print-btn { display: none !important; }
  .main { max-width: 100%; padding: 10px; }
  .meta-block { break-inside: avoid; }
  .card { break-inside: avoid; }
}

/* GRID */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.divider { height: 1px; background: var(--border); margin: 20px 0; }
</style>
</head>
<body>

<div class="topbar">
  <div style="display:flex;align-items:center;gap:14px;">
    <span class="t-logo">Nave</span>
    <span style="color:rgba(255,255,255,0.3)">|</span>
    <span class="t-title">Plano Terapêutico — {{NOME_PACIENTE}}</span>
  </div>
  <button class="print-btn" onclick="window.print()">⬇ Exportar / Imprimir</button>
</div>

<div class="main">

  <!-- IDENTIFICAÇÃO -->
  <div class="card">
    <div class="card-header">
      <h2>📋 Identificação do Paciente</h2>
    </div>
    <table class="info-table">
      <tr><td>Paciente</td><td>{{NOME_PACIENTE}}</td><td>Idade</td><td>{{IDADE}}</td></tr>
      <tr><td>Ano escolar</td><td>{{SERIE}}</td><td>Diagnóstico</td><td>{{DIAGNOSTICO}}</td></tr>
      <tr><td>Medicação</td><td>{{MEDICACAO}}</td><td>Frequência</td><td>{{FREQUENCIA}}</td></tr>
      <tr><td>Ciclo</td><td>{{PRAZO_CICLO}} semanas</td><td>Elaboração</td><td>{{DATA_ELABORACAO}}</td></tr>
      <tr><td colspan="4" style="padding-top:10px;"><strong style="color:var(--petrol);">Queixa principal:</strong> {{QUEIXA}}</td></tr>
    </table>
  </div>

  <!-- PERFIL CIF -->
  <div class="card">
    <div class="card-header">
      <h2>📘 Síntese do Perfil Clínico — CIF</h2>
    </div>
    <table class="cif-table">
      <thead>
        <tr><th>Componente CIF</th><th>Achados clínicos</th><th>Nível de impacto</th></tr>
      </thead>
      <tbody>
        <tr><td>🧠 Funções e Estruturas</td><td>{{CIF_FUNCOES}}</td><td>{{CIF_FUNCOES_IMPACTO}}</td></tr>
        <tr><td>⚙️ Atividades</td><td>{{CIF_ATIVIDADES}}</td><td>{{CIF_ATIVIDADES_IMPACTO}}</td></tr>
        <tr><td>🌍 Participação</td><td>{{CIF_PARTICIPACAO}}</td><td>{{CIF_PARTICIPACAO_IMPACTO}}</td></tr>
        <tr><td>🏠 Fatores Ambientais</td><td>{{CIF_AMBIENTAL}}</td><td>—</td></tr>
        <tr><td>⭐ Fatores Pessoais</td><td>{{CIF_PESSOAL}}</td><td>—</td></tr>
      </tbody>
    </table>
    <div style="margin-top:14px;padding:14px 16px;background:#E8F5F0;border-radius:8px;border-left:4px solid var(--teal);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#1A5C50;margin-bottom:6px;">🎯 Objetivo de Participação ao final do ciclo</div>
      <div style="font-size:13.5px;color:var(--ink);">{{OBJETIVO_PARTICIPACAO}}</div>
    </div>
  </div>

  <!-- METAS + GAS (repetir este bloco para cada meta) -->
  <!-- INICIO BLOCO META -->
  <div class="meta-block">
    <div class="meta-block-header">
      <h3>Meta {{N}} — {{DOMINIO}}</h3>
      <div class="meta-sub">Prazo: {{PRAZO}} semanas &nbsp;·&nbsp; {{DATA_INICIO}} → {{DATA_FIM}}</div>
    </div>
    <div class="baseline-bar">
      <strong>Linha de base:</strong> {{BASELINE}}
    </div>
    <div style="padding:0;">
      <div class="gas-row">
        <div class="gas-score gsc-n2">−2<small>Muito abaixo</small></div>
        <div class="gas-desc">{{GAS_N2}}</div>
      </div>
      <div class="gas-row">
        <div class="gas-score gsc-n1">−1<small>Abaixo</small></div>
        <div class="gas-desc">{{GAS_N1}}</div>
      </div>
      <div class="gas-row">
        <div class="gas-score gsc-0">0<small>✓ Meta</small></div>
        <div class="gas-desc goal">{{GAS_0}}</div>
      </div>
      <div class="gas-row">
        <div class="gas-score gsc-p1">+1<small>Acima</small></div>
        <div class="gas-desc">{{GAS_P1}}</div>
      </div>
      <div class="gas-row">
        <div class="gas-score gsc-p2">+2<small>Muito acima</small></div>
        <div class="gas-desc">{{GAS_P2}}</div>
      </div>
    </div>
    <div style="padding:16px 18px;border-top:1px solid var(--border);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--petrol);margin-bottom:10px;">Estratégias de Intervenção</div>
      <!-- Repetir strat-item para cada estratégia -->
      <div class="strat-item">
        <div class="strat-name">{{NOME_ESTRATEGIA}}</div>
        <div class="strat-why">{{JUSTIFICATIVA_CLINICA}} — {{COMO_APLICAR}}</div>
      </div>
    </div>
    <div style="padding:14px 18px;border-top:1px solid var(--border);background:#FAFCFD;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--ink-soft);margin-bottom:8px;">📝 Revisão ao final do ciclo — Nível GAS atingido</div>
      <div class="revisao-field">Preencher ao final do ciclo de {{PRAZO}} semanas...</div>
    </div>
  </div>
  <!-- FIM BLOCO META -->

  <!-- ORIENTAÇÕES FAMÍLIA -->
  <div class="card">
    <div class="card-header">
      <h2>🏠 Orientações para a Família</h2>
    </div>
    {{ORIENTACOES_FAMILIA}}
  </div>

  <!-- ORIENTAÇÕES ESCOLA -->
  <div class="card">
    <div class="card-header">
      <h2>🏫 Orientações para a Escola</h2>
    </div>
    {{ORIENTACOES_ESCOLA}}
  </div>

  <!-- PARCEIROS CLÍNICOS -->
  <div class="card" style="margin-bottom:16px;">
    <div class="card-header">
      <h2>🤝 Parceiros Clínicos e Articulações</h2>
    </div>
    {{PARCEIROS}}
  </div>

  <!-- ASSINATURA -->
  <div class="card">
    <div class="grid2">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--petrol);margin-bottom:6px;">Psicopedagoga responsável</div>
        <div style="font-size:13.5px;color:var(--ink);">{{NOME_PROFISSIONAL}}</div>
        <div style="font-size:12px;color:var(--ink-soft);">{{CBO}}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--petrol);margin-bottom:6px;">Responsável pelo paciente</div>
        <div style="font-size:13.5px;color:var(--ink);">{{NOME_RESPONSAVEL}}</div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="grid2">
      <div style="font-size:13px;color:var(--ink-soft);"><strong>Data de elaboração:</strong> {{DATA_ELABORACAO}}</div>
      <div style="font-size:13px;color:var(--ink-soft);"><strong>Revisão prevista:</strong> {{DATA_REVISAO}}</div>
    </div>
  </div>

</div>

</body>
</html>
```

---

## Instruções para geração do HTML

1. **Substitua todos os `{{PLACEHOLDER}}`** com os dados reais coletados nas etapas anteriores
2. **Repita o bloco META** para cada meta — altere o número N e os dados específicos de cada uma
3. **Para orientações à família:** use parágrafos curtos ou lista `<ul>` com ações específicas e operacionais. Não use bullets genéricos.
4. **Para estratégias:** cada `strat-item` corresponde a uma estratégia. Use o nome da técnica + justificativa clínica + como aplicar.
5. **Não inclua dependências externas** — o HTML deve funcionar offline

---

## Geração de PDF via Python / ReportLab

Se o formato escolhido for PDF, use ReportLab canvas (não Platypus). Estrutura básica:

```python
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors

# Paleta Nave
PETROL = colors.HexColor('#025073')
ROSE   = colors.HexColor('#C97A8A')
CREAM  = colors.HexColor('#F7F4F0')

# GAS colors
GAS_COLORS = {
    '-2': (colors.HexColor('#FCEAEA'), colors.HexColor('#8B1A1A')),
    '-1': (colors.HexColor('#FDF3E0'), colors.HexColor('#8B4A00')),
     '0': (colors.HexColor('#E0F0FA'), colors.HexColor('#013a52')),
    '+1': (colors.HexColor('#E4F5EF'), colors.HexColor('#1A6040')),
    '+2': (colors.HexColor('#CCEEE4'), colors.HexColor('#0A4A30')),
}
```

Use coordenadas absolutas para cada elemento. Lembre: y=0 é a base da página em ReportLab — trabalhe com A4 (595 × 842 pt) e desconte margens de 40pt em cada lado.
