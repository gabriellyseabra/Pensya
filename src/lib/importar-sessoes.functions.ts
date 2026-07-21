import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGeminiJSON } from "@/lib/gemini-client";

const NIVEIS_SUPORTE = new Set(["independente", "verbal", "gestual", "fisico_parcial", "fisico_total"]);

const HabilidadeSchema = z.object({
  habilidade: z.string().min(1),
  sub_habilidade: z.string().optional().default(""),
});

const SessaoImportSchema = z.object({
  data_sessao: z.string().min(1),
  tipo: z.enum(["avaliacao", "intervencao"]).default("intervencao"),
  duracao_min: z.number().optional().nullable(),
  engajamento: z.number().optional().nullable(),
  autorregulacao: z.number().optional().nullable(),
  nivel_suporte: z.string().optional().nullable(),
  recursos_utilizados: z.string().optional().nullable(),
  evolucao: z.string().optional().nullable(),
  habilidades_trabalhadas: z.array(HabilidadeSchema).default([]),
});

const SESSOES_PDF_SYSTEM_PROMPT = `Você é uma assistente clínica que lê registros de sessões de terapia/psicopedagogia (tabelas de atendimento — "registro de sessões", "registros de intervenção" — vindas de planilhas ou de outro sistema, geralmente exportadas em PDF) e extrai CADA LINHA/SESSÃO em formato estruturado.

REGRAS:
- Cada linha da tabela que representa uma sessão/atendimento com data vira um item do array "sessoes". Ignore cabeçalhos, linhas vazias e linhas que só indicam recesso/feriado/atendimento especial sem conteúdo clínico (ex: "CARNAVAL", "RECESSO", "Dia das crianças", "Atendimento especial") — não as inclua.
- "data_sessao": data no formato YYYY-MM-DD. Se a data vier dividida em colunas separadas (dia, mês, ano), combine-as usando o ano indicado na tabela ou próximo ao contexto.
- "tipo": "avaliacao" se a sessão for claramente de avaliação/reavaliação (ex: aplicação de testes como PROLEC, TDE, WISC), caso contrário "intervencao".
- "evolucao": uma string com TODO o conteúdo qualitativo da linha reorganizado em texto corrido — objetivos/metas trabalhadas, descrição da atividade, observações clínicas, comportamento, desempenho e orientações para a próxima sessão. NÃO invente nada, apenas reorganize o que está escrito no documento.
- "recursos_utilizados": string com os materiais/jogos/atividades citados, separados por vírgula (se houver essa informação).
- "nivel_suporte": use um destes valores — "independente", "verbal", "gestual", "fisico_parcial", "fisico_total" — SOMENTE se o texto deixar claro o nível de suporte dado (ex: "Total independência"→independente, "Pista verbal/direcionada"→verbal, "Suporte físico total"→fisico_total). Se não puder mapear com confiança, devolva null (o texto original continua preservado em "evolucao").
- "engajamento" e "autorregulacao": número inteiro de 1 a 5 SOMENTE se explicitamente mencionado ou claramente inferível; caso contrário null.
- "duracao_min": número de minutos se mencionado; caso contrário null.
- "habilidades_trabalhadas": array de {"habilidade","sub_habilidade"} com os domínios/habilidades citados como objetivo da sessão (ex: "Leitura e compreensão", "Funções executivas"). "sub_habilidade" pode ser "" se não houver detalhamento.
- NÃO invente sessões que não estão no documento. NÃO junte duas sessões de datas diferentes em uma só linha.
- Retorne SOMENTE JSON válido, sem markdown, exatamente neste schema:
{"sessoes": [{"data_sessao":"YYYY-MM-DD","tipo":"intervencao|avaliacao","duracao_min":number|null,"engajamento":number|null,"autorregulacao":number|null,"nivel_suporte":"independente|verbal|gestual|fisico_parcial|fisico_total"|null,"recursos_utilizados":"string|null","evolucao":"string|null","habilidades_trabalhadas":[{"habilidade":"string","sub_habilidade":"string"}]}]}`;

const SessoesExtraidasSchema = z.object({ sessoes: z.array(SessaoImportSchema).default([]) });

export const extrairSessoesPdfIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      pdf_base64: z.string().min(1),
      pdf_mime: z.string().optional().default("application/pdf"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    let extraido: any = {};
    try {
      extraido = await callGeminiJSON({
        model: "gemini-2.5-flash-lite",
        systemPrompt: SESSOES_PDF_SYSTEM_PROMPT,
        userPrompt: "Extraia as sessões do documento abaixo seguindo exatamente o schema indicado. Devolva SOMENTE o JSON.",
        file: { mimeType: data.pdf_mime, base64: data.pdf_base64 },
      });
    } catch (e: any) {
      throw new Error(e?.message ?? "Falha ao processar PDF com IA");
    }

    const parsed = SessoesExtraidasSchema.safeParse(extraido);
    return { sessoes: parsed.success ? parsed.data.sessoes : [] };
  });

export const importarSessoesEmLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      paciente_id: z.string().uuid(),
      sessoes: z.array(SessaoImportSchema).min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let criadas = 0;
    const erros: { data_sessao: string; erro: string }[] = [];

    for (const s of data.sessoes) {
      try {
        const nivel_suporte = s.nivel_suporte && NIVEIS_SUPORTE.has(s.nivel_suporte) ? s.nivel_suporte : null;
        const recursos_utilizados = s.recursos_utilizados
          ? s.recursos_utilizados.split(",").map((r) => r.trim()).filter(Boolean)
          : null;

        const { data: sessao, error } = await supabase
          .from("prontuario_sessoes")
          .insert({
            paciente_id: data.paciente_id,
            tipo: s.tipo,
            data_sessao: s.data_sessao,
            duracao_min: s.duracao_min ?? null,
            engajamento: s.engajamento ?? null,
            autorregulacao: s.autorregulacao ?? null,
            nivel_suporte,
            recursos_utilizados,
            evolucao: s.evolucao || null,
            habilidades_trabalhadas: s.habilidades_trabalhadas.filter((h) => h.habilidade.trim()),
            created_by: userId,
          })
          .select("id")
          .single();
        if (error || !sessao) throw new Error(error?.message ?? "insert falhou");

        await supabase.from("frequencia").insert({
          paciente_id: data.paciente_id,
          sessao_id: sessao.id,
          data_referencia: s.data_sessao,
          tipo: "presente",
          created_by: userId,
        });

        criadas++;
      } catch (e: any) {
        erros.push({ data_sessao: s.data_sessao, erro: e.message ?? String(e) });
      }
    }

    return { criadas, erros };
  });
