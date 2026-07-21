import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Link2, Plus, Copy, Check, MessageCircle, ExternalLink, UserPlus, CheckCircle2, Eye, Trash2, Ban,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { criarCadastroPublico, converterCadastroEmPaciente } from "@/lib/cadastro.functions";
import { format } from "date-fns";
import { PageHero } from "@/components/shared/PageHero";
import { Link2 as Link2Icon, CheckCircle2 as CheckIcon, Clock3 } from "lucide-react";
import { TwoColumn, PanelCard, BigStatCard, StatTile, NotifRow } from "@/components/shared/panels";

export const Route = createFileRoute("/_authenticated/cadastros")({
  component: CadastrosPage,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_preenchimento: "Em preenchimento",
  preenchido: "Pronto p/ conversão",
  convertido: "Convertido",
  expirado: "Expirado",
  arquivado: "Arquivado",
};

function cadastroUrl(token: string) {
  const path = `/cadastro/${token}`;
  return typeof window === "undefined" ? path : `${window.location.origin}${path}`;
}

function progresso(dados: any): number {
  if (!dados) return 0;
  const has = (v: any) => v && (typeof v === "string" ? v.trim() : true);
  const checks = [
    has(dados.paciente?.nome) && has(dados.paciente?.data_nascimento),
    has(dados.paciente?.escola) && has(dados.paciente?.serie_curso),
    has(dados.queixa?.queixa_principal),
    has(dados.responsaveis?.r1?.nome) && has(dados.responsaveis?.shared?.telefone),
    has(dados.contexto_familiar?.com_quem_mora) || (dados.contexto_familiar?.com_quem_mora_lista?.length > 0),
    has(dados.gestacao?.semanas) || has(dados.gestacao?.planejada),
    Array.isArray(dados.tratamentos?.lista) && dados.tratamentos.lista.length > 0,
    dados.lgpd === true,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function CadastrosPage() {
  const qc = useQueryClient();
  const { data: cadastros } = useQuery({
    queryKey: ["cadastros"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cadastro_publico")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const converter = useServerFn(converterCadastroEmPaciente);
  const conv = useMutation({
    mutationFn: (id: string) => converter({ data: { cadastroId: id } }),
    onSuccess: () => { toast.success("Paciente criado a partir do cadastro!"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarConcluido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cadastro_publico")
        .update({ status: "preenchido", preenchido_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marcado como concluído"); qc.invalidateQueries({ queryKey: ["cadastros"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cadastro_publico")
        .update({ status: "arquivado", expires_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Link cancelado"); qc.invalidateQueries({ queryKey: ["cadastros"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      // remove arquivos do storage
      const { data: files } = await supabase.storage.from("cadastro-publico").list(id);
      if (files && files.length > 0) {
        await supabase.storage.from("cadastro-publico").remove(files.map((f) => `${id}/${f.name}`));
      }
      const { error } = await supabase.from("cadastro_publico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cadastro excluído"); qc.invalidateQueries({ queryKey: ["cadastros"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor = (s: string) => ({
    pendente: "bg-muted text-muted-foreground",
    em_preenchimento: "bg-brand-yellow/30 text-foreground",
    preenchido: "bg-brand/15 text-brand",
    convertido: "bg-emerald-100 text-emerald-700",
    expirado: "bg-destructive/15 text-destructive",
    arquivado: "bg-muted text-muted-foreground",
  }[s] || "");

  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = cadastros?.find((c) => c.id === previewId);

  const totalCad = cadastros?.length ?? 0;
  const prontos = (cadastros ?? []).filter((c) => c.status === "preenchido").length;
  const emAndamento = (cadastros ?? []).filter((c) => c.status === "em_preenchimento").length;
  const convertidos = (cadastros ?? []).filter((c) => c.status === "convertido").length;
  const distStatus = Object.keys(STATUS_LABEL)
    .map((s) => ({
      status: s,
      label: STATUS_LABEL[s],
      count: (cadastros ?? []).filter((c) => c.status === s).length,
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  const prontosList = (cadastros ?? [])
    .filter((c) => c.status === "preenchido")
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHero
        icon={Link2Icon}
        eyebrow="Recepção"
        title="Cadastros públicos"
        description="Envie o link para a família preencher e converta em paciente com um clique."
        actions={
          <NovoCadastroDialog onCreated={() => qc.invalidateQueries({ queryKey: ["cadastros"] })} />
        }
        stats={[
          { label: "Total", value: totalCad, icon: Link2Icon },
          { label: "Em andamento", value: emAndamento, icon: Clock3 },
          { label: "Prontos", value: prontos, icon: CheckIcon },
        ]}
      />

      <TwoColumn
        side={<CadastrosSidePanel distStatus={distStatus} prontosList={prontosList} statusColor={statusColor} />}
      >
        {/* Visão modular */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BigStatCard
            label="Cadastros gerados"
            value={totalCad}
            icon={Link2Icon}
            bars={distStatus.map((d) => ({ value: d.count }))}
            hint="Por situação"
            delay={40}
          />
          <div className="animate-fade-up card-lift soft-card p-5" style={{ animationDelay: "100ms" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Fluxo</span>
              <Clock3 className="h-4 w-4 text-lilac" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={Clock3} value={emAndamento} label="Em andamento" />
              <StatTile icon={CheckIcon} value={prontos} label="Prontos" />
            </div>
          </div>
          <BigStatCard
            label="Convertidos em paciente"
            value={convertidos}
            icon={UserPlus}
            hint={totalCad > 0 ? `${Math.round((convertidos / totalCad) * 100)}% do total` : undefined}
            delay={160}
          />
        </div>

        <div className="grid gap-3">
        {cadastros?.map((c, i) => {
          const url = cadastroUrl(c.token);
          const dados = (c.dados_json ?? {}) as any;
          const nome = dados.paciente?.nome || c.enviado_para_nome || "Sem nome";
          const pct = progresso(dados);
          const podeConverter = c.status === "preenchido" || (c.status === "em_preenchimento" && pct >= 50);
          return (
            <Card
              key={c.id}
              className="glass card-lift animate-fade-up p-5"
              style={{ animationDelay: `${Math.min(i * 45, 360)}ms` }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <p className="font-semibold truncate">{nome}</p>
                    <Badge className={statusColor(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                    {c.status !== "convertido" && (
                      <span className="text-xs text-muted-foreground">{pct}% preenchido</span>
                    )}
                  </div>
                  {c.status !== "convertido" && (
                    <Progress value={pct} className="h-1.5 mb-2 max-w-xs" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Criado em {format(new Date(c.created_at), "dd/MM/yyyy HH:mm")} ·
                    Expira em {format(new Date(c.expires_at), "dd/MM/yyyy")}
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <code className="text-xs bg-muted/60 px-2 py-1 rounded truncate max-w-[260px]">{url}</code>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
                      <Copy className="w-3.5 h-3.5 mr-1" />Copiar
                    </Button>
                    {c.enviado_para_telefone && (
                      <Button size="sm" variant="outline" asChild>
                        <a target="_blank" rel="noreferrer" href={`https://web.whatsapp.com/send?phone=${c.enviado_para_telefone.replace(/\D/g, '')}&text=${encodeURIComponent(`Olá! Segue o link para preencher o cadastro: ${url}`)}`}>
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <a target="_blank" rel="noreferrer" href={url}><ExternalLink className="w-3.5 h-3.5 mr-1" />Abrir</a>
                    </Button>
                    {(pct > 0 || c.status === "convertido") && (
                      <Button size="sm" variant="outline" onClick={() => setPreviewId(c.id)}>
                        <Eye className="w-3.5 h-3.5 mr-1" />Ver respostas
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {c.status === "em_preenchimento" && pct >= 30 && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={marcarConcluido.isPending}
                      onClick={() => marcarConcluido.mutate(c.id)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Marcar como concluído
                    </Button>
                  )}
                  {podeConverter && c.status !== "convertido" && (
                    <Button size="sm" className="gradient-brand text-white" disabled={conv.isPending} onClick={() => conv.mutate(c.id)}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" />Converter em paciente
                    </Button>
                  )}
                  {c.status === "convertido" && c.paciente_id_criado && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/pacientes/${c.paciente_id_criado}`}>Ver paciente</a>
                    </Button>
                  )}
                  {c.status !== "convertido" && c.status !== "arquivado" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      disabled={cancelar.isPending}
                      onClick={() => cancelar.mutate(c.id)}
                    >
                      <Ban className="w-3.5 h-3.5 mr-1" />Cancelar link
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-1" />Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir cadastro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação remove permanentemente o cadastro e os arquivos enviados. Não pode ser desfeita.
                          {c.status === "convertido" && " O paciente já criado a partir deste cadastro não será removido."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => excluir.mutate(c.id)}
                        >
                          Excluir definitivamente
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          );
        })}
        {cadastros?.length === 0 && (
          <Card className="glass p-12 text-center text-muted-foreground">
            <Link2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Nenhum cadastro gerado ainda. Crie o primeiro link!
          </Card>
        )}
        </div>
      </TwoColumn>

      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="glass-strong max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Respostas do cadastro</DialogTitle>
            <DialogDescription>Resumo do que a família preencheu até agora.</DialogDescription>
          </DialogHeader>
          {preview && <PreviewDados dados={preview.dados_json as any} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CadastrosSidePanel({
  distStatus,
  prontosList,
  statusColor,
}: {
  distStatus: { status: string; label: string; count: number }[];
  prontosList: any[];
  statusColor: (s: string) => string;
}) {
  const max = Math.max(1, ...distStatus.map((d) => d.count));
  return (
    <>
      <PanelCard title="Situação dos cadastros" icon={Link2Icon} delay={80}>
        {distStatus.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Sem cadastros ainda.</p>
        ) : (
          <div className="space-y-2.5">
            {distStatus.map((d) => (
              <div key={d.status}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate text-foreground">{d.label}</span>
                  <span className="shrink-0 text-muted-foreground">{d.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-lilac-soft/50">
                  <div
                    className="h-full rounded-full bg-lilac"
                    style={{ width: `${(d.count / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard title="Prontos para conversão" icon={CheckIcon} delay={140}>
        {prontosList.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nenhum cadastro aguardando conversão.
          </p>
        ) : (
          <div className="space-y-1">
            {prontosList.map((c) => {
              const dados = (c.dados_json ?? {}) as any;
              const nome = dados.paciente?.nome || c.enviado_para_nome || "Sem nome";
              return (
                <NotifRow
                  key={c.id}
                  leading={
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  }
                  title={nome}
                  subtitle={`Criado em ${format(new Date(c.created_at), "dd/MM/yyyy")}`}
                  trailing={
                    <Badge className={statusColor(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  }
                />
              );
            })}
          </div>
        )}
      </PanelCard>
    </>
  );
}

function hasVal(v: any): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined && x !== "").length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function fmtVal(v: any): string {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

function fmtData(v: any): string | null {
  if (!v || typeof v !== "string") return v ?? null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function Secao({
  titulo,
  rows = [],
  children,
}: {
  titulo: string;
  rows?: [string, any][];
  children?: React.ReactNode;
}) {
  const visiveis = rows.filter(([, v]) => hasVal(v));
  if (visiveis.length === 0 && !children) return null;
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <h3 className="mb-2.5 text-sm font-semibold text-brand">{titulo}</h3>
      {visiveis.length > 0 && (
        <dl className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
          {visiveis.map(([label, v]) => (
            <div key={label} className="flex gap-1.5">
              <dt className="shrink-0 text-muted-foreground">{label}:</dt>
              <dd className="font-medium break-words">{fmtVal(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </div>
  );
}

function PreviewDados({ dados }: { dados: any }) {
  if (!dados || Object.keys(dados).length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nada preenchido ainda.</p>;
  }

  const p = dados.paciente ?? {};
  const q = dados.queixa ?? {};
  const r = dados.responsaveis ?? {};
  const c = dados.contexto_familiar ?? {};
  const dev = dados.desenvolvimento ?? {};
  const g = dados.gestacao ?? {};
  const parto = dados.parto ?? {};
  const s = dados.saude ?? {};
  const t = dados.tratamentos ?? {};
  const fin = dados.financeiro ?? {};
  const rotina = c.rotina ?? {};
  const meds: any[] = Array.isArray(s.medicacoes_lista) ? s.medicacoes_lista : [];
  const anexos: any[] = Array.isArray(q.exames_anexos) ? q.exames_anexos : [];

  const endereco = [
    p.logradouro && `${p.logradouro}${p.numero ? `, ${p.numero}` : ""}`,
    p.complemento,
    p.bairro,
    (p.cidade || p.uf) && `${p.cidade ?? ""}${p.uf ? `/${p.uf}` : ""}`,
    p.cep && `CEP ${p.cep}`,
  ].filter(Boolean).join(" · ");

  const contatoEscola = [p.escola_contato_nome, p.escola_contato_telefone, p.escola_contato_email]
    .filter(Boolean).join(" · ");

  const nfNome = fin.nf_responsavel === "r1" ? r.r1?.nome
    : fin.nf_responsavel === "r2" ? r.r2?.nome : null;

  const respBlock = (resp: any, titulo: string) => {
    if (!hasVal(resp?.nome)) return null;
    const partes = [
      resp.parentesco,
      resp.idade && `${resp.idade} anos`,
      resp.profissao,
    ].filter(Boolean).join(" · ");
    return (
      <p className="text-sm">
        <span className="text-muted-foreground">{titulo}: </span>
        <span className="font-medium">{resp.nome}</span>
        {partes && <span className="text-muted-foreground"> — {partes}</span>}
      </p>
    );
  };

  return (
    <div className="space-y-3 text-sm">
      <Secao
        titulo="Paciente"
        rows={[
          ["Nome", p.nome],
          ["Nascimento", fmtData(p.data_nascimento)],
          ["CPF", p.cpf],
          ["Gênero", p.genero],
          ["Escola", p.escola],
          ["Série / ano", p.serie_curso],
          ["Período", p.periodo],
          ["Contato na escola", contatoEscola],
          ["Endereço", endereco],
          ["Autoriza imagem", p.autoriza_imagem === true ? "Sim" : p.autoriza_imagem === false ? "Não" : null],
        ]}
      >
        {p.foto_url && (
          <img src={p.foto_url} alt="" className="mt-3 h-20 w-20 rounded-xl object-cover ring-2 ring-brand/20" />
        )}
      </Secao>

      <Secao
        titulo="Queixa clínica"
        rows={[
          ["Queixa principal", q.queixa_principal],
          ["Expectativas", q.expectativas],
          ["Já tem diagnóstico?", q.diagnostico_status],
          ["Diagnóstico(s)", [...(q.diagnosticos ?? []), q.diagnostico_outro].filter(Boolean)],
          ["Outros especialistas", q.outros_especialistas_lista],
          ["Detalhes especialistas", q.outros_especialistas],
          ["Exames / avaliações", q.exames_lista],
          ["Observações de exames", q.exames_clinicos],
        ]}
      >
        {anexos.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Anexos ({anexos.length})</p>
            <div className="flex flex-wrap gap-2">
              {anexos.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs hover:bg-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-brand" />
                  <span className="max-w-[180px] truncate">{a.name ?? "arquivo"}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </Secao>

      <Secao
        titulo="Responsáveis"
        rows={[
          ["Estado civil", r.shared?.estado_civil],
          ["WhatsApp", r.shared?.telefone],
          ["E-mail", r.shared?.email],
        ]}
      >
        <div className="mb-2 space-y-1">
          {respBlock(r.r1, "Responsável 1")}
          {respBlock(r.r2, "Responsável 2")}
        </div>
      </Secao>

      <Secao
        titulo="Financeiro"
        rows={[
          ["Dia de vencimento", fin.dia_vencimento ? `Dia ${fin.dia_vencimento}` : null],
          ["Deseja Nota Fiscal", fin.deseja_nf === true ? "Sim" : fin.deseja_nf === false ? "Não" : null],
          ["NF em nome de", nfNome],
          ["CPF/CNPJ da NF", fin.nf_cpf],
        ]}
      />

      <Secao
        titulo="Família"
        rows={[
          ["Com quem mora", c.com_quem_mora_lista],
          ["Detalhes moradia", c.com_quem_mora],
          ["Relação dos pais", c.relacao_pais_tag],
          ["Detalhes relação", c.relacao_pais],
          ["Rede de apoio", c.rede_apoio_lista],
          ["Detalhes apoio", c.rede_apoio],
          ["Histórico familiar", c.historico_familiar_tag],
          ["Detalhes histórico", c.historico_familiar],
        ]}
      >
        {(hasVal(rotina.manha) || hasVal(rotina.tarde) || hasVal(rotina.noite)) && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Rotina da família</p>
            {hasVal(rotina.manha) && <p><span className="text-muted-foreground">Manhã: </span>{rotina.manha}</p>}
            {hasVal(rotina.tarde) && <p><span className="text-muted-foreground">Tarde: </span>{rotina.tarde}</p>}
            {hasVal(rotina.noite) && <p><span className="text-muted-foreground">Noite: </span>{rotina.noite}</p>}
          </div>
        )}
      </Secao>

      <Secao
        titulo="Desenvolvimento"
        rows={[
          ["Engatinhou", dev.engatinhou],
          ["Andou", dev.andou],
          ["Primeiras palavras", dev.primeiras_palavras],
          ["Sinais de atraso", dev.sinais_atraso_lista],
          ["Detalhes atraso", dev.sinais_atraso],
          ["Esportes / atividades", [...(dev.atividades_lista ?? []), dev.atividades].filter(Boolean)],
          ["Interesses", dev.interesses],
          ["Restrições", dev.restricoes],
          ["Dificuldades escolares", [...(dev.dificuldades_disciplinas ?? []), dev.dificuldades_obs].filter(Boolean)],
          ["Uso de eletrônicos", [dev.eletronicos_tempo, dev.eletronicos].filter(Boolean)],
        ]}
      />

      <Secao
        titulo="Gestação e parto"
        rows={[
          ["Gestação planejada", g.planejada],
          ["Pré-natal", g.pre_natal],
          ["Semanas", g.semanas],
          ["Intercorrências gestação", [...(g.intercorrencias_lista ?? []), g.intercorrencias].filter(Boolean)],
          ["Substâncias", g.substancias],
          ["Tipo de parto", parto.tipo],
          ["Intercorrências parto", [...(parto.intercorrencias_lista ?? []), parto.intercorrencias].filter(Boolean)],
          ["Peso ao nascer", parto.peso_kg && `${parto.peso_kg} kg`],
          ["Comprimento", parto.comprimento_cm && `${parto.comprimento_cm} cm`],
          ["Apgar", parto.apgar],
        ]}
      />

      <Secao
        titulo="Saúde"
        rows={[
          ["Internações / cirurgias", [s.internacoes_tag, s.internacoes].filter(Boolean)],
          ["Outras questões", [...(s.outras_lista ?? []), s.outras].filter(Boolean)],
          ["Tratamentos anteriores", t.lista],
          ["Usa medicação contínua", s.medicacoes_tag],
        ]}
      >
        {meds.filter((m) => hasVal(m?.nome)).length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Medicações de uso contínuo</p>
            {meds.filter((m) => hasVal(m?.nome)).map((m, i) => (
              <p key={i}>
                <span className="font-medium">{m.nome}</span>
                {(m.posologia || m.frequencia) && (
                  <span className="text-muted-foreground"> — {[m.posologia, m.frequencia].filter(Boolean).join(", ")}</span>
                )}
              </p>
            ))}
          </div>
        )}
      </Secao>

      <p className="pt-1 text-xs text-muted-foreground">
        {dados.lgpd ? "✓ Termos de LGPD aceitos" : "⚠ Termos de LGPD ainda não aceitos"}
      </p>
    </div>
  );
}

function NovoCadastroDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const criar = useServerFn(criarCadastroPublico);
  const mut = useMutation({
    mutationFn: () => criar({ data: { nome, telefone, diasValidade: 30 } }),
    onSuccess: (r: any) => {
      const url = cadastroUrl(r.token);
      setLink(url);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function close() {
    setOpen(false); setLink(null); setNome(""); setTelefone("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : close()}>
      <DialogTrigger asChild>
        <Button className="gradient-brand text-white"><Plus className="w-4 h-4 mr-1.5" />Gerar link de cadastro</Button>
      </DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader>
          <DialogTitle>Novo link de cadastro</DialogTitle>
          <DialogDescription>Gere um link único para a família preencher.</DialogDescription>
        </DialogHeader>
        {!link ? (
          <div className="space-y-4">
            <div><Label>Nome do paciente (opcional)</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>Telefone do responsável (opcional, p/ WhatsApp)</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="55 21 99999-9999" /></div>
            <p className="text-xs text-muted-foreground">O link expira em 30 dias.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-lg">
              <Check className="w-4 h-4" /><span className="text-sm font-medium">Link criado!</span>
            </div>
            <Input readOnly value={link} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(link); toast.success("Copiado"); }}>
              <Copy className="w-4 h-4 mr-1.5" />Copiar link
            </Button>
            {telefone && (
              <Button className="w-full gradient-brand text-white" asChild>
                <a target="_blank" rel="noreferrer" href={`https://web.whatsapp.com/send?phone=${telefone.replace(/\D/g, '')}&text=${encodeURIComponent(`Olá! Segue o link para preencher o cadastro inicial: ${link}`)}`}>
                  <MessageCircle className="w-4 h-4 mr-1.5" />Enviar pelo WhatsApp
                </a>
              </Button>
            )}
          </div>
        )}
        <DialogFooter>
          {!link ? (
            <>
              <Button variant="outline" onClick={close}>Cancelar</Button>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gradient-brand text-white">Gerar link</Button>
            </>
          ) : (
            <Button onClick={close}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
