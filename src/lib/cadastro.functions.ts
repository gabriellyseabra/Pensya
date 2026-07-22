import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const criarCadastroPublico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      nome: z.string().trim().max(200).optional(),
      telefone: z.string().trim().max(40).optional(),
      diasValidade: z.number().int().min(1).max(180).default(30),
      modeloId: z.string().uuid().optional().nullable(),
      dataNascimento: z.string().trim().max(20).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = genToken();
    const expires = new Date(Date.now() + data.diasValidade * 86400_000).toISOString();
    // Pré-preenche a data de nascimento (quando informada) para que a faixa
    // etária — e o modelo de perguntas — já seja resolvida no formulário.
    const dadosIniciais = data.dataNascimento
      ? { paciente: { data_nascimento: data.dataNascimento } }
      : undefined;
    const { data: row, error } = await supabase
      .from("cadastro_publico")
      .insert({
        token,
        status: "pendente",
        enviado_para_nome: data.nome ?? null,
        enviado_para_telefone: data.telefone ?? null,
        expires_at: expires,
        created_by: userId,
        modelo_id: data.modeloId ?? null,
        ...(dadosIniciais ? { dados_json: dadosIniciais } : {}),
      })
      .select("id, token, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const converterCadastroEmPaciente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ cadastroId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cad, error: e1 } = await supabase
      .from("cadastro_publico")
      .select("*")
      .eq("id", data.cadastroId)
      .single();
    if (e1 || !cad) throw new Error(e1?.message ?? "Cadastro não encontrado");
    if (cad.paciente_id_criado) throw new Error("Cadastro já foi convertido");

    const d = (cad.dados_json ?? {}) as Record<string, any>;
    const paciente = d.paciente ?? {};
    const queixa = d.queixa ?? {};
    const resps = d.responsaveis ?? {};
    const fin = d.financeiro ?? {};

    // Endereço composto a partir dos campos preenchidos via CEP.
    const endereco = [
      paciente.logradouro && `${paciente.logradouro}${paciente.numero ? `, ${paciente.numero}` : ""}`,
      paciente.complemento,
      paciente.bairro,
      (paciente.cidade || paciente.uf) && `${paciente.cidade ?? ""}${paciente.uf ? `/${paciente.uf}` : ""}`,
      paciente.cep && `CEP ${paciente.cep}`,
    ].filter(Boolean).join(" · ") || null;

    // Contato da escola: nome/telefone/e-mail informados pela família.
    const contatoEscola = [
      paciente.escola_contato_nome,
      paciente.escola_contato_telefone,
      paciente.escola_contato_email,
    ].filter(Boolean).join(" · ") || null;

    // Vincula a escola informada (texto livre) a um registro em `escolas`:
    // reaproveita a existente pelo nome ou cria uma nova.
    let escolaId: string | null = null;
    const nomeEscola = (paciente.escola ?? "").trim();
    if (nomeEscola) {
      const { data: escExist } = await supabase
        .from("escolas")
        .select("id")
        .ilike("nome", nomeEscola)
        .limit(1)
        .maybeSingle();
      if (escExist?.id) {
        escolaId = escExist.id;
      } else {
        const { data: escNova } = await supabase
          .from("escolas")
          .insert({ nome: nomeEscola })
          .select("id")
          .single();
        escolaId = escNova?.id ?? null;
      }
    }

    // Origem da aquisição informada pela família ("Como conheceu a Nave?").
    const origem = d.origem ?? {};
    const MAPA_ORIGEM: Record<string, string> = {
      "Instagram": "Instagram",
      "Indicação": "Indicação",
      "Indicação de família ou amigo": "Indicação",
      "Escola ou parceiro": "Escola",
      "Google ou busca": "Google Ads",
      "Facebook": "Facebook/Meta Ads",
      "Evento": "Evento",
      "Outro": "Outro",
    };
    let canalOrigemId: string | null = null;
    const rotuloOrigem = (origem.canal ?? "").trim();
    if (rotuloOrigem) {
      const nomeCanal = MAPA_ORIGEM[rotuloOrigem] ?? "Outro";
      const { data: canalExist } = await supabase
        .from("canais_marketing").select("id").ilike("nome", nomeCanal).limit(1).maybeSingle();
      if (canalExist?.id) {
        canalOrigemId = canalExist.id;
      } else {
        const { data: canalNovo } = await supabase
          .from("canais_marketing").insert({ nome: nomeCanal }).select("id").single();
        canalOrigemId = canalNovo?.id ?? null;
      }
    }
    const origemDetalhe = [rotuloOrigem, (origem.detalhe ?? "").trim()].filter(Boolean).join(" — ") || null;

    // Diagnóstico informado pela família (sem campo próprio no perfil → vai para observações).
    const diagStatus = queixa.diagnostico_status ?? null;
    const diagnosticos = [...(queixa.diagnosticos ?? []), queixa.diagnostico_outro].filter(Boolean);
    const observacoes = [
      paciente.periodo && `Período escolar: ${paciente.periodo}`,
      diagStatus && `Diagnóstico (informado pela família): ${diagStatus}`,
      diagnosticos.length > 0 && `Diagnóstico(s): ${diagnosticos.join(", ")}`,
    ].filter(Boolean).join("\n") || null;

    const { data: novoPac, error: e2 } = await supabase
      .from("pacientes")
      .insert({
        nome: paciente.nome ?? "Sem nome",
        data_nascimento: paciente.data_nascimento || null,
        cpf: paciente.cpf || null,
        genero: paciente.genero || null,
        foto_url: paciente.foto_url || null,
        telefone: resps.shared?.telefone || null,
        email: resps.shared?.email || null,
        endereco,
        escola_id: escolaId,
        serie_curso: paciente.serie_curso || null,
        contato_escola: contatoEscola,
        autoriza_imagem: paciente.autoriza_imagem ?? null,
        queixa_principal: queixa.queixa_principal || null,
        expectativas: queixa.expectativas || null,
        // "Em investigação" indica hipótese diagnóstica em aberto.
        hipotese_diagnostica: diagStatus === "Em investigação",
        observacoes,
        modelo_pagamento: fin.modelo_pagamento || "mensalidade",
        valor_acordado: fin.valor_acordado || null,
        dia_vencimento: fin.dia_vencimento || null,
        canal_origem_id: canalOrigemId,
        origem_detalhe: origemDetalhe,
        origem_criacao: "cadastro_publico",
        status: "ativo",
      })
      .select("id")
      .single();
    if (e2 || !novoPac) throw new Error(e2?.message ?? "Erro ao criar paciente");

    // Nota Fiscal emitida em nome de qual responsável (padrão: R1).
    const querNf = !!fin.deseja_nf;
    const nfEm = fin.nf_responsavel === "r2" ? "r2" : "r1";

    const respList: any[] = [];
    if (resps.r1?.nome) {
      respList.push({
        paciente_id: novoPac.id,
        nome: resps.r1.nome,
        idade: resps.r1.idade ?? null,
        profissao: resps.r1.profissao ?? null,
        parentesco: resps.r1.parentesco ?? null,
        telefone: resps.shared?.telefone ?? null,
        email: resps.shared?.email ?? null,
        estado_civil: resps.shared?.estado_civil ?? null,
        deseja_nf: querNf && nfEm === "r1",
        dados_nf: querNf && nfEm === "r1" ? (fin.nf_cpf ?? null) : null,
        principal: true,
      });
    }
    if (resps.r2?.nome) {
      respList.push({
        paciente_id: novoPac.id,
        nome: resps.r2.nome,
        idade: resps.r2.idade ?? null,
        profissao: resps.r2.profissao ?? null,
        parentesco: resps.r2.parentesco ?? null,
        telefone: resps.shared?.telefone ?? null,
        email: resps.shared?.email ?? null,
        estado_civil: resps.shared?.estado_civil ?? null,
        deseja_nf: querNf && nfEm === "r2",
        dados_nf: querNf && nfEm === "r2" ? (fin.nf_cpf ?? null) : null,
        principal: false,
      });
    }
    if (respList.length > 0) await supabase.from("responsaveis").insert(respList);

    await supabase.from("paciente_pre_anamnese").insert({
      paciente_id: novoPac.id,
      cadastro_publico_id: cad.id,
      // Preserva rotina (dentro de contexto_familiar), marcos/perfil (desenvolvimento)
      // e as respostas das perguntas extras do modelo de cadastro (personalizado).
      contexto_familiar: {
        ...(d.contexto_familiar ?? {}),
        desenvolvimento: d.desenvolvimento ?? {},
        ...(d.personalizado ? { perguntas_modelo: d.personalizado } : {}),
      },
      gestacao: d.gestacao ?? {},
      parto: d.parto ?? {},
      saude: d.saude ?? {},
      tratamentos_anteriores: d.tratamentos ?? {},
      outros_especialistas: queixa.outros_especialistas ?? {},
      exames_clinicos: {
        texto: queixa.exames_clinicos ?? null,
        lista: queixa.exames_lista ?? [],
      },
    });

    // Move anexos de exames enviados no cadastro para os documentos do paciente.
    const anexos: any[] = Array.isArray(queixa.exames_anexos) ? queixa.exames_anexos : [];
    for (const a of anexos) {
      if (!a?.path) continue;
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from("cadastro-publico")
          .download(a.path);
        if (dlErr || !blob) continue;
        const ext = (a.name?.split(".").pop() || "bin").toLowerCase();
        const newPath = `pacientes/${novoPac.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("pacientes-docs")
          .upload(newPath, blob, { contentType: a.mime || undefined, upsert: false });
        if (upErr) continue;
        await supabase.from("paciente_documentos").insert({
          paciente_id: novoPac.id,
          titulo: a.name || "Exame anexado",
          categoria: "Exame",
          descricao: "Anexado pela família no cadastro público",
          storage_path: newPath,
          mime_type: a.mime || null,
          tamanho_bytes: a.size ?? null,
        });
        await supabase.storage.from("cadastro-publico").remove([a.path]);
      } catch {
        /* ignora falha em um anexo isolado */
      }
    }

    await supabase
      .from("cadastro_publico")
      .update({
        status: "convertido",
        paciente_id_criado: novoPac.id,
        convertido_em: new Date().toISOString(),
      })
      .eq("id", cad.id);

    return { pacienteId: novoPac.id };
  });

// ============================================================
// Cadastro simplificado de paciente (manual)
// ============================================================
export const criarPacienteRapido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      nome: z.string().trim().min(2).max(200),
      data_nascimento: z.string().optional().nullable(),
      escola_id: z.string().uuid().optional().nullable(),
      serie_curso: z.string().optional().nullable(),
      modelo_pagamento: z.string().optional().nullable(),
      valor_acordado: z.number().optional().nullable(),
      convenio: z.string().optional().nullable(),
      responsavel_nome: z.string().optional().nullable(),
      responsavel_telefone: z.string().optional().nullable(),
      responsavel_parentesco: z.string().optional().nullable(),
      canal_origem_id: z.string().uuid().optional().nullable(),
      origem_detalhe: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pac, error } = await supabase
      .from("pacientes")
      .insert({
        nome: data.nome,
        data_nascimento: data.data_nascimento || null,
        escola_id: data.escola_id || null,
        serie_curso: data.serie_curso || null,
        modelo_pagamento: data.modelo_pagamento || null,
        valor_acordado: data.valor_acordado ?? null,
        observacoes: data.convenio ? `Convênio: ${data.convenio}` : null,
        telefone: data.responsavel_telefone || null,
        canal_origem_id: data.canal_origem_id || null,
        origem_detalhe: data.origem_detalhe || null,
        origem_criacao: "manual",
        status: "ativo",
      })
      .select("id")
      .single();
    if (error || !pac) throw new Error(error?.message ?? "Erro ao criar paciente");

    if (data.responsavel_nome) {
      await supabase.from("responsaveis").insert({
        paciente_id: pac.id,
        nome: data.responsavel_nome,
        telefone: data.responsavel_telefone || null,
        parentesco: data.responsavel_parentesco || null,
        principal: true,
      });
    }
    return { pacienteId: pac.id };
  });

// ============================================================
// Arquivar / restaurar / excluir definitivo
// ============================================================
export const arquivarPaciente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pacienteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pacientes")
      .update({ arquivado: true, arquivado_em: new Date().toISOString(), status: "arquivado" })
      .eq("id", data.pacienteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restaurarPaciente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pacienteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pacientes")
      .update({ arquivado: false, arquivado_em: null, status: "ativo" })
      .eq("id", data.pacienteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirPacienteDefinitivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ pacienteId: z.string().uuid(), confirmacaoNome: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem excluir definitivamente");

    const { data: pac, error: eGet } = await supabase
      .from("pacientes")
      .select("nome")
      .eq("id", data.pacienteId)
      .single();
    if (eGet || !pac) throw new Error("Paciente não encontrado");
    if (pac.nome.trim().toLowerCase() !== data.confirmacaoNome.trim().toLowerCase()) {
      throw new Error("Nome de confirmação não confere");
    }

    // Apaga em ordem manual para tabelas sem ON DELETE CASCADE.
    const child = [
      "responsaveis", "paciente_pre_anamnese", "paciente_diagnosticos",
      "paciente_documentos", "paciente_profissionais", "atendimentos",
      "frequencia", "metas_terapeuticas", "tarefas", "reunioes",
    ];
    for (const t of child) {
      await supabase.from(t as any).delete().eq("paciente_id", data.pacienteId);
    }
    const { error } = await supabase.from("pacientes").delete().eq("id", data.pacienteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Criação rápida de escola
// ============================================================
export const criarEscolaRapida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      nome: z.string().trim().min(2).max(200),
      endereco: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("escolas")
      .insert({ nome: data.nome, endereco: data.endereco || null })
      .select("id, nome")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Erro ao criar escola");
    return row;
  });
