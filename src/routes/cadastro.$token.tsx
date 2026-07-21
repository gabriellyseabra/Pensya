import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, Check, ArrowLeft, ArrowRight, Shield, AlertCircle, FileText, Paperclip, X,
  ListChecks, Asterisk, ClipboardCheck, Mail, Plus, Trash2, Heart,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getConfiguracaoClinica } from "@/lib/clinica-config";

export const Route = createFileRoute("/cadastro/$token")({
  ssr: false,
  component: CadastroPublicoPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="glass-strong p-8 max-w-md text-center">
        <h1 className="text-2xl font-display mb-2">Link inválido</h1>
        <p className="text-muted-foreground">
          Este link de cadastro não é válido ou já expirou. Entre em contato com a clínica.
        </p>
      </Card>
    </div>
  ),
});

type Dados = {
  paciente?: any;
  queixa?: any;
  responsaveis?: any;
  contexto_familiar?: any;
  desenvolvimento?: any;
  gestacao?: any;
  parto?: any;
  saude?: any;
  tratamentos?: any;
  financeiro?: any;
  origem?: any;
  lgpd?: boolean;
};

const STEP_LABELS = [
  "Dados do paciente",
  "Queixa clínica",
  "Responsáveis",
  "Família",
  "Desenvolvimento",
  "Saúde",
];

const ESCOLARIDADE_OPTIONS = [
  "Berçário", "Maternal", "Pré-escola",
  "1º ano EF", "2º ano EF", "3º ano EF", "4º ano EF", "5º ano EF",
  "6º ano EF", "7º ano EF", "8º ano EF", "9º ano EF",
  "1º ano EM", "2º ano EM", "3º ano EM",
  "Técnico", "Graduação", "Pós-graduação", "Não estuda",
];

function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/pensya-logo.svg"
      alt="Pensya"
      className={cn("w-auto object-contain", className)}
    />
  );
}

function CadastroPublicoPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [cadId, setCadId] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0 = boas-vindas; 1..6 = etapas
  const [dados, setDados] = useState<Dados>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const lgpdRef = useRef<HTMLDivElement>(null);
  const [showLgpdError, setShowLgpdError] = useState(false);
  const { data: clinicaCfg } = useQuery({ queryKey: ["configuracao-clinica"], queryFn: getConfiguracaoClinica });
  const nomeClinica = clinicaCfg?.nome_clinica?.trim() || "nossa clínica";

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("cadastro_publico_get", { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setLoading(false); return; }
      if (new Date(row.expires_at) < new Date()) {
        setLoading(false);
        return;
      }
      setCadId(row.id);
      const d = (row.dados_json ?? {}) as Dados;
      setDados(d);
      // Se já começou a preencher, retoma na etapa salva (pula boas-vindas).
      const jaComecou = row.etapa_atual > 1 || Object.keys(d).length > 0;
      setStep(jaComecou ? Math.max(1, Math.min(6, row.etapa_atual ?? 1)) : 0);
      if (row.status === "preenchido" || row.status === "convertido") setDone(true);
      setLoading(false);
    })();
  }, [token]);

  const totalSteps = 6;

  async function salvarParcial(novosDados: Dados, novaEtapa: number, marcarConcluido = false) {
    if (!cadId) return;
    setSaving(true);
    const { error } = await supabase.rpc("cadastro_publico_save", {
      _token: token,
      _dados: novosDados as any,
      _etapa: Math.max(1, Math.min(totalSteps, novaEtapa)),
      _concluir: marcarConcluido,
    });
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      throw error;
    }
  }

  async function enviarFinal() {
    if (!dados.lgpd) {
      setShowLgpdError(true);
      lgpdRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("É preciso aceitar os termos de LGPD antes de enviar.");
      return;
    }
    try {
      await salvarParcial(dados, totalSteps, true);
      setDone(true);
    } catch {
      /* toast already shown */
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-muted-foreground">Carregando...</div></div>;
  }
  if (!cadId) throw notFound();

  if (done) return <Agradecimento />;

  const update = (patch: Partial<Dados>) => setDados((d) => ({ ...d, ...patch }));

  async function next() {
    try {
      await salvarParcial(dados, step + 1);
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { /* */ }
  }
  function prev() { setStep((s) => Math.max(1, s - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }

  // ===== Boas-vindas =====
  if (step === 0) {
    return <BoasVindas nomeClinica={nomeClinica} onStart={() => { setStep(1); window.scrollTo({ top: 0 }); }} />;
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center mb-6">
          <Logo className="h-12" />
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium text-foreground">
              {step}. {STEP_LABELS[step - 1]}
            </span>
            <span>{saving ? "Salvando..." : "Salvo automaticamente"}</span>
          </div>
          <Progress value={(step / totalSteps) * 100} />
          <p className="mt-1 text-[11px] text-muted-foreground">Etapa {step} de {totalSteps}</p>
        </div>

        <Card className="glass-strong p-6 md:p-8">
          {step === 1 && <EtapaPaciente dados={dados} onChange={update} cadId={cadId} nomeClinica={nomeClinica} />}
          {step === 2 && <EtapaQueixa dados={dados} onChange={update} cadId={cadId} nomeClinica={nomeClinica} />}
          {step === 3 && <EtapaResponsaveis dados={dados} onChange={update} />}
          {step === 4 && <EtapaFamilia dados={dados} onChange={update} />}
          {step === 5 && <EtapaDesenvolvimento dados={dados} onChange={update} />}
          {step === 6 && (
            <EtapaSaudeRevisao
              dados={dados}
              onChange={(p: Partial<Dados>) => { update(p); if ("lgpd" in p) setShowLgpdError(false); }}
              onGoto={(s: number) => { setStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              lgpdRef={lgpdRef}
              showLgpdError={showLgpdError}
              nomeClinica={nomeClinica}
            />
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button variant="outline" onClick={prev} disabled={step === 1}>
              <ArrowLeft className="w-4 h-4 mr-2" />Voltar
            </Button>
            {step < totalSteps ? (
              <Button onClick={next} className="gradient-brand text-white">
                Continuar<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={enviarFinal} className="gradient-brand text-white">
                Enviar cadastro<Check className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3" />
          Dados protegidos · LGPD · Lei 13.709/2018
        </p>
      </div>
    </div>
  );
}

/* ============== BOAS-VINDAS ============== */

function BoasVindas({ onStart, nomeClinica }: { onStart: () => void; nomeClinica: string }) {
  const passos = [
    {
      n: "1",
      titulo: "São 6 etapas curtas",
      texto: "Dados do paciente, queixa clínica, responsáveis, família, desenvolvimento e saúde.",
    },
    {
      n: "2",
      titulo: "Campos com * são obrigatórios",
      texto: "Os demais são opcionais — preencha o que for possível agora.",
    },
    {
      n: "3",
      titulo: "Revise antes de enviar",
      texto: "Na última etapa você verá um resumo completo para conferir tudo.",
    },
  ];
  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4">
      <div className="max-w-2xl w-full">
        <div className="flex justify-center mb-8">
          <Logo className="h-16 md:h-20" />
        </div>

        <Card className="glass-strong p-7 md:p-10 relative overflow-hidden animate-fade-up">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-lilac/20 blur-3xl" />
          <div className="relative">
            <h1 className="text-4xl md:text-5xl font-display leading-[1.05] mb-4">
              Que bom ter<br />
              <span className="text-gradient-brand">vocês aqui…</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Estamos muito felizes em iniciar esse cuidado junto com a sua família.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Este formulário nos ajuda a conhecer melhor quem vai chegar à {nomeClinica}, para que o
              acompanhamento seja individualizado desde o primeiro encontro.
            </p>

            <div className="mt-7 space-y-3">
              {passos.map((p) => (
                <div
                  key={p.n}
                  className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-card/60 p-4"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full gradient-brand text-white text-sm font-semibold">
                    {p.n}
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{p.titulo}</p>
                    <p className="text-sm text-muted-foreground">{p.texto}</p>
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-3.5 rounded-2xl border border-brand/30 bg-brand/5 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-sm">Contrato por e-mail</p>
                  <p className="text-sm text-muted-foreground">
                    Após o envio do cadastro, você receberá o contrato de prestação de serviços no
                    e-mail informado para assinatura digital.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={onStart} className="mt-8 w-full gradient-brand text-white h-12 text-base">
              Começar cadastro<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-center text-[11px] text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
              <Shield className="w-3 h-3" /> Dados protegidos · LGPD · Lei 13.709/2018
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============== AGRADECIMENTO ============== */

function Agradecimento() {
  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4">
      <div className="max-w-lg w-full">
        <div className="flex justify-center mb-8">
          <Logo className="h-14" />
        </div>
        <Card className="glass-strong p-8 md:p-10 text-center relative overflow-hidden animate-fade-up">
          <div className="pointer-events-none absolute -left-10 -top-16 h-52 w-52 rounded-full bg-lilac/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto w-16 h-16 rounded-full gradient-brand flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-display mb-2">Recebemos o seu cadastro 💜</h1>
            <p className="text-muted-foreground">
              Muito obrigado por compartilhar essas informações com a gente. Elas nos ajudam a
              preparar um acompanhamento individualizado desde o primeiro encontro.
            </p>
            <p className="text-muted-foreground mt-2">
              Em breve entraremos em contato pelo WhatsApp com os próximos passos, e você receberá o
              contrato no e-mail informado para assinatura.
            </p>

            <p className="text-xs text-muted-foreground mt-6">Dados protegidos · LGPD</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============== HELPERS DE UI ============== */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Chips({
  value, options, onChange, multi = false,
}: { value: string | string[]; options: string[]; onChange: (v: any) => void; multi?: boolean }) {
  const sel = (o: string) => {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    } else onChange(value === o ? "" : o);
  };
  const isSel = (o: string) => multi ? (Array.isArray(value) && value.includes(o)) : value === o;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => sel(o)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
            isSel(o)
              ? "gradient-brand text-white border-transparent shadow-soft"
              : "bg-background/60 border-border hover:border-brand/50 hover:bg-accent/40"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function QuickText({
  value, onChange, options, rows = 2, placeholder,
}: { value: string; onChange: (v: string) => void; options?: string[]; rows?: number; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {options && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(value ? `${value.trim()} ${o}`.trim() : o)}
              className="text-[11px] px-2 py-1 rounded-md bg-secondary/60 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Upload de anexos (foto ou PDF) para o bucket público; move-se ao paciente na conversão. */
function AnexoUploader({ cadId, value, onChange }: { cadId: string; value: any[]; onChange: (v: any[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const list = Array.isArray(value) ? value : [];

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    const novos: any[] = [];
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) { toast.error(`${file.name}: máx 15MB`); continue; }
      const okTipo = file.type.startsWith("image/") || file.type === "application/pdf";
      if (!okTipo) { toast.error(`${file.name}: envie imagem (JPG/PNG) ou PDF`); continue; }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${cadId}/exames/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("cadastro-publico").upload(path, file, { contentType: file.type, upsert: false });
      if (error) { toast.error(error.message); continue; }
      const { data: signed } = await supabase.storage.from("cadastro-publico").createSignedUrl(path, 60 * 60 * 24 * 365);
      novos.push({ path, name: file.name, mime: file.type, size: file.size, url: signed?.signedUrl });
    }
    onChange([...list, ...novos]);
    setUploading(false);
    e.target.value = "";
  }

  async function remover(item: any) {
    await supabase.storage.from("cadastro-publico").remove([item.path]);
    onChange(list.filter((x) => x.path !== item.path));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {list.map((item) => (
          <div key={item.path} className="flex items-center gap-2 rounded-full border border-border bg-card/70 pl-3 pr-1.5 py-1 text-xs">
            {item.mime === "application/pdf" ? <FileText className="h-3.5 w-3.5 text-brand" /> : <Paperclip className="h-3.5 w-3.5 text-brand" />}
            <span className="max-w-[160px] truncate">{item.name}</span>
            <button type="button" onClick={() => remover(item)} className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent">
        <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
        <Upload className="h-4 w-4" />
        {uploading ? "Enviando..." : "Anexar foto ou PDF"}
      </label>
      <p className="text-[11px] text-muted-foreground">Imagens ou PDF, até 15MB cada. Os arquivos irão para os documentos do paciente.</p>
    </div>
  );
}

/* ============== ETAPA 1 — PACIENTE ============== */

function EtapaPaciente({ dados, onChange, cadId, nomeClinica }: any) {
  const p = dados.paciente ?? {};
  const set = (k: string, v: any) => onChange({ paciente: { ...p, [k]: v } });
  const [uploading, setUploading] = useState(false);

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Máx 5MB"); return; }
    const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type.includes("heic") || file.type.includes("heif");
    if (isHeic) {
      toast.error("Formato HEIC (iPhone) não é exibido no navegador. Envie como JPG ou PNG.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem JPG ou PNG.");
      return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${cadId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("cadastro-publico").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: signed, error: sErr } = await supabase.storage.from("cadastro-publico").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr || !signed?.signedUrl) {
      toast.error("Foto enviada, mas não foi possível gerar o preview.");
    }
    onChange({ paciente: { ...p, foto_url: signed?.signedUrl, foto_path: path } });
    setUploading(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-display mb-1">Dados do paciente</h2>
        <p className="text-sm text-muted-foreground">Informações cadastrais básicas</p>
      </div>

      <div>
        <Label>Foto do paciente</Label>
        <div className="mt-2 flex items-center gap-4">
          {p.foto_url ? (
            <img src={p.foto_url} className="w-20 h-20 rounded-2xl object-cover ring-2 ring-brand/20" alt="" />
          ) : (
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <label className="cursor-pointer">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFoto} disabled={uploading} />
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-secondary hover:bg-accent text-sm font-medium">
              {uploading ? "Enviando..." : p.foto_url ? "Trocar foto" : "Adicionar foto"}
            </span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG · até 5MB</p>
      </div>

      <Field label="Nome completo *">
        <Input value={p.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
      </Field>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Data de nascimento *">
          <Input type="date" value={p.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value)} />
        </Field>
        <Field label="CPF">
          <Input value={p.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" />
        </Field>
      </div>

      <Field label="Gênero">
        <Chips
          value={p.genero ?? ""}
          options={["Feminino", "Masculino", "Não-binário", "Prefere não dizer"]}
          onChange={(v) => set("genero", v)}
        />
      </Field>

      <Field label="Escola / Universidade *">
        <Input value={p.escola ?? ""} onChange={(e) => set("escola", e.target.value)} />
      </Field>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Série / Ano *">
          <Select value={p.serie_curso ?? ""} onValueChange={(v) => set("serie_curso", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {ESCOLARIDADE_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Período">
          <Chips
            value={p.periodo ?? ""}
            options={["Manhã", "Tarde", "Integral", "Noite"]}
            onChange={(v) => set("periodo", v)}
          />
        </Field>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Contato na escola">
          <Input placeholder="Coordenador(a) / professor(a)" value={p.escola_contato_nome ?? ""} onChange={(e) => set("escola_contato_nome", e.target.value)} />
        </Field>
        <Field label="Telefone da escola">
          <Input placeholder="(21) 99999-9999" value={p.escola_contato_telefone ?? ""} onChange={(e) => set("escola_contato_telefone", e.target.value)} />
        </Field>
        <Field label="E-mail da escola">
          <Input type="email" placeholder="contato@escola.com" value={p.escola_contato_email ?? ""} onChange={(e) => set("escola_contato_email", e.target.value)} />
        </Field>
      </div>

      <EnderecoCep dados={p} onChange={(patch) => onChange({ paciente: { ...p, ...patch } })} />
      <Field label="Autorização de imagem" hint="Se permite que o(a) paciente apareça em registros internos">
        <Chips
          value={p.autoriza_imagem === true ? "Autorizo" : p.autoriza_imagem === false ? "Não autorizo" : ""}
          options={["Autorizo", "Não autorizo"]}
          onChange={(v) => set("autoriza_imagem", v === "Autorizo" ? true : v === "Não autorizo" ? false : null)}
        />
      </Field>

      <div className="pt-3 border-t">
        <Field label={`Como você conheceu a ${nomeClinica}?`} hint="Nos ajuda a entender por onde as famílias chegam até nós">
          <Chips
            value={dados.origem?.canal ?? ""}
            options={["Instagram", "Indicação de família ou amigo", "Escola ou parceiro", "Google ou busca", "Facebook", "Evento", "Outro"]}
            onChange={(v) => onChange({ origem: { ...(dados.origem ?? {}), canal: v } })}
          />
          {(dados.origem?.canal === "Indicação de família ou amigo" ||
            dados.origem?.canal === "Escola ou parceiro" ||
            dados.origem?.canal === "Outro") && (
            <Input
              className="mt-2"
              placeholder={
                dados.origem?.canal === "Escola ou parceiro"
                  ? "Qual escola ou parceiro?"
                  : dados.origem?.canal === "Indicação de família ou amigo"
                    ? "Quem indicou? (opcional)"
                    : "Conte um pouco mais (opcional)"
              }
              value={dados.origem?.detalhe ?? ""}
              onChange={(e) => onChange({ origem: { ...(dados.origem ?? {}), detalhe: e.target.value } })}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

/* ============== ETAPA 2 — QUEIXA ============== */

function EtapaQueixa({ dados, onChange, cadId, nomeClinica }: any) {
  const q = dados.queixa ?? {};
  const set = (k: string, v: any) => onChange({ queixa: { ...q, [k]: v } });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-display mb-1">Queixa e histórico clínico</h2>
        <p className="text-sm text-muted-foreground">O que trouxe a família até a {nomeClinica}</p>
      </div>

      <Field label="Queixa principal *" hint="Toque nos atalhos para acelerar o preenchimento">
        <QuickText
          value={q.queixa_principal ?? ""}
          onChange={(v) => set("queixa_principal", v)}
          rows={3}
          options={[
            "Dificuldade de leitura", "Dificuldade na escrita", "Dificuldade em matemática",
            "Atenção/concentração", "Comportamento", "Sociabilidade", "Organização escolar",
            "Ansiedade", "Recusa escolar",
          ]}
        />
      </Field>

      <Field
        label="Expectativas com o acompanhamento *"
        hint="Descreva o que faria você dizer que o acompanhamento está valendo a pena — que mudanças você gostaria de vivenciar."
      >
        <QuickText
          value={q.expectativas ?? ""}
          onChange={(v) => set("expectativas", v)}
          rows={3}
          options={["Mais autonomia", "Mais confiança", "Menos ansiedade", "Melhora na escola", "Orientação aos pais"]}
          placeholder="Ex.: gostaria de ver mais segurança na leitura e menos frustração nas tarefas…"
        />
      </Field>

      <Field label="Já possui diagnóstico?">
        <Chips
          value={q.diagnostico_status ?? ""}
          options={["Sim", "Não", "Em investigação"]}
          onChange={(v) => set("diagnostico_status", v)}
        />
      </Field>
      {(q.diagnostico_status === "Sim" || q.diagnostico_status === "Em investigação") && (
        <Field label="Qual(is) diagnóstico(s)?">
          <Chips
            value={q.diagnosticos ?? []}
            multi
            options={["TEA", "TDAH", "Dislexia", "Discalculia", "Disgrafia", "Transtorno de Ansiedade", "TOD", "Altas Habilidades", "Outro"]}
            onChange={(v) => set("diagnosticos", v)}
          />
          {Array.isArray(q.diagnosticos) && q.diagnosticos.includes("Outro") && (
            <Input className="mt-2" placeholder="Especifique" value={q.diagnostico_outro ?? ""} onChange={(e) => set("diagnostico_outro", e.target.value)} />
          )}
        </Field>
      )}

      <Field label="Acompanhamento com outros especialistas">
        <Chips
          value={q.outros_especialistas_lista ?? []}
          multi
          options={["Psicólogo(a)", "Fonoaudiólogo(a)", "Terapeuta Ocupacional", "Psiquiatra", "Neurologista", "Pediatra", "Nenhum"]}
          onChange={(v) => set("outros_especialistas_lista", v)}
        />
        <Textarea
          className="mt-2"
          rows={2}
          placeholder="Nome, contato e observações (opcional)"
          value={q.outros_especialistas ?? ""}
          onChange={(e) => set("outros_especialistas", e.target.value)}
        />
      </Field>

      <Field label="Exames e avaliações relevantes" hint="Marque os que se aplicam e anexe o que já tiver (ou traga na 1ª sessão)">
        <Chips
          value={q.exames_lista ?? []}
          multi
          options={[
            "Avaliação neuropsicológica", "PAC (Processamento Auditivo Central)",
            "Audição (audiometria)", "Vista (oftalmológico)", "Neurológico",
            "Genético", "Exames de sangue", "Levar na primeira sessão", "Nenhum",
          ]}
          onChange={(v) => set("exames_lista", v)}
        />
        <div className="mt-3">
          <AnexoUploader cadId={cadId} value={q.exames_anexos ?? []} onChange={(v) => set("exames_anexos", v)} />
        </div>
        <Textarea
          className="mt-3"
          rows={2}
          placeholder="Detalhes (opcional)"
          value={q.exames_clinicos ?? ""}
          onChange={(e) => set("exames_clinicos", e.target.value)}
        />
      </Field>
    </div>
  );
}

/* ============== ETAPA 3 — RESPONSÁVEIS + FINANCEIRO ============== */

function EtapaResponsaveis({ dados, onChange }: any) {
  const r = dados.responsaveis ?? {};
  const f = dados.financeiro ?? {};
  const setR = (k: string, v: any) => onChange({ responsaveis: { ...r, [k]: v } });
  const setF = (k: string, v: any) => onChange({ financeiro: { ...f, [k]: v } });
  const setR1 = (k: string, v: any) => setR("r1", { ...(r.r1 ?? {}), [k]: v });
  const setR2 = (k: string, v: any) => setR("r2", { ...(r.r2 ?? {}), [k]: v });
  const setShared = (k: string, v: any) => setR("shared", { ...(r.shared ?? {}), [k]: v });

  const nomeR1 = (r.r1?.nome ?? "").trim();
  const nomeR2 = (r.r2?.nome ?? "").trim();
  const nfOptions = [nomeR1 && `R1 — ${nomeR1}`, nomeR2 && `R2 — ${nomeR2}`].filter(Boolean) as string[];
  const nfValue = f.nf_responsavel === "r1" && nomeR1 ? `R1 — ${nomeR1}`
    : f.nf_responsavel === "r2" && nomeR2 ? `R2 — ${nomeR2}` : "";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-display mb-1">Responsáveis e financeiro</h2>
        <p className="text-sm text-muted-foreground">Contato e informações de faturamento</p>
      </div>

      <div className="space-y-4 p-4 rounded-2xl bg-secondary/40">
        <h3 className="font-semibold">Responsável 1 *</h3>
        <Input placeholder="Nome completo" value={r.r1?.nome ?? ""} onChange={(e) => setR1("nome", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Idade" value={r.r1?.idade ?? ""} onChange={(e) => setR1("idade", e.target.value)} />
          <Input placeholder="Profissão" value={r.r1?.profissao ?? ""} onChange={(e) => setR1("profissao", e.target.value)} />
        </div>
        <Field label="Parentesco">
          <Chips
            value={r.r1?.parentesco ?? ""}
            options={["Mãe", "Pai", "Avó/Avô", "Tio(a)", "Tutor(a) legal", "Outro"]}
            onChange={(v) => setR1("parentesco", v)}
          />
        </Field>
      </div>

      <div className="space-y-4 p-4 rounded-2xl bg-secondary/40">
        <h3 className="font-semibold">Responsável 2 <span className="font-normal text-muted-foreground text-sm">(opcional)</span></h3>
        <Input placeholder="Nome completo" value={r.r2?.nome ?? ""} onChange={(e) => setR2("nome", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Idade" value={r.r2?.idade ?? ""} onChange={(e) => setR2("idade", e.target.value)} />
          <Input placeholder="Profissão" value={r.r2?.profissao ?? ""} onChange={(e) => setR2("profissao", e.target.value)} />
        </div>
        <Field label="Parentesco">
          <Chips
            value={r.r2?.parentesco ?? ""}
            options={["Mãe", "Pai", "Avó/Avô", "Tio(a)", "Tutor(a) legal", "Outro"]}
            onChange={(v) => setR2("parentesco", v)}
          />
        </Field>
      </div>

      <Field label="Estado civil dos responsáveis">
        <Chips
          value={r.shared?.estado_civil ?? ""}
          options={["Casados", "União estável", "Divorciados", "Solteiros", "Viúvo(a)", "Outros"]}
          onChange={(v) => setShared("estado_civil", v)}
        />
      </Field>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="WhatsApp do responsável *" hint="Onde você receberá contatos e o link de pagamento">
          <Input value={r.shared?.telefone ?? ""} onChange={(e) => setShared("telefone", e.target.value)} placeholder="(21) 99999-9999" />
        </Field>
        <Field label="E-mail *" hint="Onde chegará o contrato para assinatura">
          <Input type="email" value={r.shared?.email ?? ""} onChange={(e) => setShared("email", e.target.value)} />
        </Field>
      </div>

      <div className="pt-4 border-t">
        <h3 className="font-semibold mb-3">Financeiro</h3>
        <div className="rounded-2xl border border-brand/25 bg-brand/5 p-4 text-sm">
          <p>
            O pagamento é feito em <strong>valor fixo mensal</strong>, por meio de um{" "}
            <strong>link de pagamento (InfinitePay)</strong> enviado ao <strong>WhatsApp</strong> do
            responsável. É rápido, seguro e aceita PIX e cartão.
          </p>
        </div>

        <div className="mt-4">
          <Field label="Dia de vencimento preferido *" hint="A cobrança mensal chega no WhatsApp. Escolha o melhor dia (até o dia 15).">
            <Chips
              value={f.dia_vencimento ? `Dia ${f.dia_vencimento}` : ""}
              options={Array.from({ length: 15 }, (_, i) => `Dia ${i + 1}`)}
              onChange={(v: string) => setF("dia_vencimento", v ? Number(v.replace(/\D/g, "")) : null)}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Deseja Nota Fiscal?">
            <Chips
              value={f.deseja_nf === true ? "Sim" : f.deseja_nf === false ? "Não" : ""}
              options={["Sim", "Não"]}
              onChange={(v) => setF("deseja_nf", v === "Sim" ? true : v === "Não" ? false : null)}
            />
          </Field>
        </div>
        {f.deseja_nf && (
          <div className="mt-3 space-y-3">
            <Field label="Em nome de qual responsável emitir a NF?">
              {nfOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Preencha o nome do responsável acima para escolher.
                </p>
              ) : (
                <Chips
                  value={nfValue}
                  options={nfOptions}
                  onChange={(v: string) =>
                    setF("nf_responsavel", v.startsWith("R1") ? "r1" : v.startsWith("R2") ? "r2" : null)
                  }
                />
              )}
            </Field>
            {f.nf_responsavel && (
              <Field label="CPF/CNPJ para a nota fiscal" hint="Documento do responsável que receberá a NF">
                <Input
                  value={f.nf_cpf ?? ""}
                  onChange={(e) => setF("nf_cpf", e.target.value)}
                  placeholder="000.000.000-00"
                />
              </Field>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============== ETAPA 4 — FAMÍLIA ============== */

function EtapaFamilia({ dados, onChange }: any) {
  const c = dados.contexto_familiar ?? {};
  const setC = (k: string, v: any) => onChange({ contexto_familiar: { ...c, [k]: v } });
  const rotina = c.rotina ?? {};
  const setRotina = (k: string, v: any) => setC("rotina", { ...rotina, [k]: v });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display mb-1">Contexto familiar</h2>
        <p className="text-sm text-muted-foreground">Quem convive e como é a rotina em casa</p>
      </div>

      <Field label="Com quem mora a criança? *">
        <Chips
          value={c.com_quem_mora_lista ?? []}
          multi
          options={["Mãe", "Pai", "Irmão(s)", "Avós", "Padrasto/Madrasta", "Tio(a)", "Outros"]}
          onChange={(v) => setC("com_quem_mora_lista", v)}
        />
        <Input
          className="mt-2"
          placeholder="Detalhes / outros (opcional)"
          value={c.com_quem_mora ?? ""}
          onChange={(e) => setC("com_quem_mora", e.target.value)}
        />
      </Field>

      <Field label="Relação entre os pais / responsáveis *">
        <Chips
          value={c.relacao_pais_tag ?? ""}
          options={["Harmoniosa", "Tranquila", "Conflituosa", "Pais separados — boa relação", "Pais separados — pouco contato"]}
          onChange={(v) => setC("relacao_pais_tag", v)}
        />
        <Textarea
          className="mt-2"
          rows={2}
          placeholder="Detalhes (opcional)"
          value={c.relacao_pais ?? ""}
          onChange={(e) => setC("relacao_pais", e.target.value)}
        />
      </Field>

      <Field label="Rede de apoio e contraturno">
        <Chips
          value={c.rede_apoio_lista ?? []}
          multi
          options={["Avós", "Babá/Cuidador(a)", "Tios(as)", "Escola integral", "Atividades extracurriculares", "Acompanhante terapêutico", "Nenhum"]}
          onChange={(v) => setC("rede_apoio_lista", v)}
        />
        <Input
          className="mt-2"
          placeholder="Detalhes (opcional)"
          value={c.rede_apoio ?? ""}
          onChange={(e) => setC("rede_apoio", e.target.value)}
        />
      </Field>

      <Field label="Histórico familiar semelhante" hint="Algum familiar com diagnóstico ou queixa parecida">
        <Chips
          value={c.historico_familiar_tag ?? ""}
          options={["Não", "Sim — pais", "Sim — irmãos", "Sim — outros parentes"]}
          onChange={(v) => setC("historico_familiar_tag", v)}
        />
        <Textarea
          className="mt-2"
          rows={2}
          placeholder="Detalhes (opcional)"
          value={c.historico_familiar ?? ""}
          onChange={(e) => setC("historico_familiar", e.target.value)}
        />
      </Field>

      <div className="space-y-3 pt-4 border-t">
        <div>
          <h3 className="font-semibold">Rotina da família</h3>
          <p className="text-xs text-muted-foreground">Como costumam ser os períodos do dia da criança</p>
        </div>
        <Field label="Manhã">
          <Textarea rows={2} placeholder="Ex.: acorda às 7h, escola, café…" value={rotina.manha ?? ""} onChange={(e) => setRotina("manha", e.target.value)} />
        </Field>
        <Field label="Tarde">
          <Textarea rows={2} placeholder="Ex.: almoço, lição, atividades, descanso…" value={rotina.tarde ?? ""} onChange={(e) => setRotina("tarde", e.target.value)} />
        </Field>
        <Field label="Noite">
          <Textarea rows={2} placeholder="Ex.: jantar, banho, telas, hora de dormir…" value={rotina.noite ?? ""} onChange={(e) => setRotina("noite", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

/* ============== ETAPA 5 — DESENVOLVIMENTO ============== */

function EtapaDesenvolvimento({ dados, onChange }: any) {
  const g = dados.gestacao ?? {};
  const p = dados.parto ?? {};
  const dev = dados.desenvolvimento ?? {};
  const setG = (k: string, v: any) => onChange({ gestacao: { ...g, [k]: v } });
  const setP = (k: string, v: any) => onChange({ parto: { ...p, [k]: v } });
  const setDev = (k: string, v: any) => onChange({ desenvolvimento: { ...dev, [k]: v } });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display mb-1">Desenvolvimento</h2>
        <p className="text-sm text-muted-foreground">Gestação, parto, marcos e rotina — toque nos atalhos</p>
      </div>

      {/* Gestação */}
      <div className="space-y-4">
        <h3 className="font-semibold">História gestacional</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Gestação planejada?">
            <Chips value={g.planejada ?? ""} options={["Sim", "Não"]} onChange={(v) => setG("planejada", v)} />
          </Field>
          <Field label="Pré-natal">
            <Chips value={g.pre_natal ?? ""} options={["Completo", "Parcial", "Não realizou"]} onChange={(v) => setG("pre_natal", v)} />
          </Field>
        </div>
        <Field label="Intercorrências na gestação">
          <Chips
            value={g.intercorrencias_lista ?? []}
            multi
            options={["Nenhuma", "Pressão alta", "Diabetes gestacional", "Sangramentos", "Estresse intenso", "Outras"]}
            onChange={(v) => setG("intercorrencias_lista", v)}
          />
          <Textarea className="mt-2" rows={2} placeholder="Detalhes (opcional)" value={g.intercorrencias ?? ""} onChange={(e) => setG("intercorrencias", e.target.value)} />
        </Field>
        <Field label="Semanas de gestação">
          <Chips value={g.semanas ?? ""} options={["A termo (37-41)", "Prematuro (<37)", "Pós-termo (>41)"]} onChange={(v) => setG("semanas", v)} />
        </Field>
      </div>

      {/* Parto */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold">Parto</h3>
        <Field label="Tipo de parto">
          <Chips value={p.tipo ?? ""} options={["Cesáreo", "Normal", "Fórceps"]} onChange={(v) => setP("tipo", v)} />
        </Field>
        <Field label="Intercorrências no parto">
          <Chips
            value={p.intercorrencias_lista ?? []}
            multi
            options={["Nenhuma", "Sofrimento fetal", "Icterícia", "UTI neonatal", "Cordão enrolado", "Outras"]}
            onChange={(v) => setP("intercorrencias_lista", v)}
          />
        </Field>
      </div>

      {/* Marcos */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold">Marcos do desenvolvimento</h3>
        <p className="text-xs text-muted-foreground -mt-2">Uma média aproximada já ajuda muito — sem preocupação com precisão</p>
        <Field label="Começou a engatinhar por volta de">
          <Chips
            value={dev.engatinhou ?? ""}
            options={["Antes dos 6 meses", "6–9 meses", "9–12 meses", "Depois dos 12 meses", "Não engatinhou", "Não lembro"]}
            onChange={(v) => setDev("engatinhou", v)}
          />
        </Field>
        <Field label="Começou a andar por volta de">
          <Chips
            value={dev.andou ?? ""}
            options={["Antes de 1 ano", "12–15 meses", "15–18 meses", "Depois dos 18 meses", "Não lembro"]}
            onChange={(v) => setDev("andou", v)}
          />
        </Field>
        <Field label="Primeiras palavras por volta de">
          <Chips
            value={dev.primeiras_palavras ?? ""}
            options={["Antes de 1 ano", "12–18 meses", "18–24 meses", "Depois dos 2 anos", "Não lembro"]}
            onChange={(v) => setDev("primeiras_palavras", v)}
          />
        </Field>
        <Field label="Percebeu sinais de atraso em algum domínio?" hint="Fala, motor, social, aprendizagem…">
          <Chips
            value={dev.sinais_atraso_lista ?? []}
            multi
            options={["Não percebi", "Fala / linguagem", "Motor", "Social / interação", "Aprendizagem", "Não sei dizer"]}
            onChange={(v) => setDev("sinais_atraso_lista", v)}
          />
          <Textarea className="mt-2" rows={2} placeholder="Detalhes (opcional)" value={dev.sinais_atraso ?? ""} onChange={(e) => setDev("sinais_atraso", e.target.value)} />
        </Field>
      </div>

      {/* Rotina, interesses e escola */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold">Perfil, interesses e escola</h3>

        <Field label="Pratica esportes ou atividades extracurriculares?">
          <Chips
            value={dev.atividades_lista ?? []}
            multi
            options={["Esporte", "Música", "Dança", "Artes", "Idiomas", "Reforço", "Nenhuma"]}
            onChange={(v) => setDev("atividades_lista", v)}
          />
          <Input className="mt-2" placeholder="Quais? (opcional)" value={dev.atividades ?? ""} onChange={(e) => setDev("atividades", e.target.value)} />
        </Field>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Interesses" hint="O que gosta de fazer, temas favoritos">
            <Textarea rows={2} placeholder="Ex.: dinossauros, desenhar, futebol…" value={dev.interesses ?? ""} onChange={(e) => setDev("interesses", e.target.value)} />
          </Field>
          <Field label="Restrições" hint="O que não gosta, evita ou incomoda">
            <Textarea rows={2} placeholder="Ex.: barulhos altos, texturas, mudanças…" value={dev.restricoes ?? ""} onChange={(e) => setDev("restricoes", e.target.value)} />
          </Field>
        </div>

        <Field label="Disciplinas de maior dificuldade na escola">
          <Chips
            value={dev.dificuldades_disciplinas ?? []}
            multi
            options={["Português / Leitura", "Escrita", "Matemática", "Ciências", "História / Geografia", "Inglês", "Ed. Física", "Artes", "Nenhuma específica"]}
            onChange={(v) => setDev("dificuldades_disciplinas", v)}
          />
          <Input className="mt-2" placeholder="Observações (opcional)" value={dev.dificuldades_obs ?? ""} onChange={(e) => setDev("dificuldades_obs", e.target.value)} />
        </Field>

        <Field label="Uso de eletrônicos na rotina" hint="Tempo médio de telas por dia">
          <Chips
            value={dev.eletronicos_tempo ?? ""}
            options={["Menos de 1h/dia", "1–2h/dia", "2–4h/dia", "Mais de 4h/dia"]}
            onChange={(v) => setDev("eletronicos_tempo", v)}
          />
          <Input className="mt-2" placeholder="O que costuma usar/assistir (opcional)" value={dev.eletronicos ?? ""} onChange={(e) => setDev("eletronicos", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

/* ============== ETAPA 6 — SAÚDE + REVISÃO ============== */

function EtapaSaudeRevisao({ dados, onChange, onGoto, lgpdRef, showLgpdError, nomeClinica }: any) {
  const s = dados.saude ?? {};
  const t = dados.tratamentos ?? {};
  const setS = (k: string, v: any) => onChange({ saude: { ...s, [k]: v } });
  const setT = (k: string, v: any) => onChange({ tratamentos: { ...t, [k]: v } });

  const meds: any[] = Array.isArray(s.medicacoes_lista) ? s.medicacoes_lista : [];
  const setMeds = (arr: any[]) => setS("medicacoes_lista", arr);
  const addMed = () => setMeds([...meds, { nome: "", posologia: "", frequencia: "" }]);
  const setMed = (i: number, k: string, v: any) => setMeds(meds.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const rmMed = (i: number) => setMeds(meds.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-display mb-1">Saúde e revisão</h2>
        <p className="text-sm text-muted-foreground">Quase lá! Últimas informações e conferência</p>
      </div>

      <Field label="Internações e cirurgias">
        <Chips value={s.internacoes_tag ?? ""} options={["Nenhuma", "Sim — pequenas", "Sim — grandes"]} onChange={(v) => setS("internacoes_tag", v)} />
        <Textarea className="mt-2" rows={2} placeholder="Detalhes (opcional)" value={s.internacoes ?? ""} onChange={(e) => setS("internacoes", e.target.value)} />
      </Field>

      <Field label="Outras questões de saúde">
        <Chips
          value={s.outras_lista ?? []}
          multi
          options={["Alergias", "Asma", "Epilepsia", "Refluxo", "Distúrbio de sono", "Distúrbio alimentar", "Nenhuma"]}
          onChange={(v) => setS("outras_lista", v)}
        />
        <Textarea className="mt-2" rows={2} placeholder="Detalhes (opcional)" value={s.outras ?? ""} onChange={(e) => setS("outras", e.target.value)} />
      </Field>

      <Field label="Tratamentos anteriores *">
        <Chips
          value={t.lista ?? []}
          multi
          options={["Nenhum", "Psicólogo(a)", "Fonoaudiólogo(a)", "Psiquiatra", "Terapeuta Ocupacional", "Psicopedagogo(a) anteriormente", "Outro"]}
          onChange={(v) => setT("lista", v)}
        />
      </Field>

      <Field label="Medicações de uso contínuo">
        <Chips
          value={s.medicacoes_tag ?? ""}
          options={["Nenhuma", "Sim"]}
          onChange={(v) => { setS("medicacoes_tag", v); if (v === "Sim" && meds.length === 0) addMed(); }}
        />
        {s.medicacoes_tag === "Sim" && (
          <div className="mt-3 space-y-3">
            {meds.map((m, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Medicamento {i + 1}</span>
                  <button type="button" onClick={() => rmMed(i)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input placeholder="Nome do medicamento" value={m.nome ?? ""} onChange={(e) => setMed(i, "nome", e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Posologia (ex.: 10mg)" value={m.posologia ?? ""} onChange={(e) => setMed(i, "posologia", e.target.value)} />
                  <Input placeholder="Frequência (ex.: 1x ao dia)" value={m.frequencia ?? ""} onChange={(e) => setMed(i, "frequencia", e.target.value)} />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addMed}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar medicamento
            </Button>
          </div>
        )}
      </Field>

      {/* Revisão */}
      <div className="pt-4 border-t">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <ClipboardCheck className="h-4 w-4 text-brand" /> Revisão final
        </h3>
        <Resumo dados={dados} onGoto={onGoto} />
      </div>

      <div ref={lgpdRef} className="pt-2 scroll-mt-20">
        <div
          className={cn(
            "flex items-start gap-3 p-4 rounded-2xl transition-all",
            showLgpdError
              ? "bg-destructive/10 ring-2 ring-destructive animate-pulse"
              : dados.lgpd
                ? "bg-brand/10 ring-1 ring-brand/30"
                : "bg-accent-soft/40 ring-1 ring-border"
          )}
        >
          <Checkbox
            id="lgpd"
            checked={dados.lgpd ?? false}
            onCheckedChange={(c) => onChange({ lgpd: !!c })}
            className="mt-0.5"
          />
          <Label htmlFor="lgpd" className="text-sm leading-relaxed cursor-pointer">
            <span className="font-semibold">Aceito os termos de LGPD *</span>
            <br />
            <span className="text-muted-foreground">
              Li e aceito que os dados informados serão utilizados pela equipe da {nomeClinica} para
              fins de avaliação e acompanhamento clínico, sendo armazenados de forma segura e confidencial,
              em conformidade com a LGPD (Lei 13.709/2018).
            </span>
          </Label>
        </div>
        {showLgpdError && (
          <p className="text-xs text-destructive mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Aceite os termos acima para enviar o cadastro.
          </p>
        )}
      </div>
    </div>
  );
}

/* ============== RESUMO (revisão) ============== */

function Resumo({ dados, onGoto }: { dados: Dados; onGoto: (s: number) => void }) {
  const p = dados.paciente ?? {};
  const q = dados.queixa ?? {};
  const r = dados.responsaveis ?? {};
  const c = dados.contexto_familiar ?? {};
  const dev = dados.desenvolvimento ?? {};
  const val = (v: any) => {
    if (Array.isArray(v)) return v.filter(Boolean).join(", ") || "—";
    return (v ?? "").toString().trim() || "—";
  };
  const anexos = Array.isArray(q.exames_anexos) ? q.exames_anexos.length : 0;

  const blocos: { etapa: number; titulo: string; itens: [string, any][] }[] = [
    { etapa: 1, titulo: "Paciente", itens: [
      ["Nome", p.nome], ["Nascimento", p.data_nascimento], ["Escola", p.escola], ["Série", p.serie_curso],
    ] },
    { etapa: 2, titulo: "Queixa", itens: [
      ["Queixa principal", p ? q.queixa_principal : ""], ["Expectativas", q.expectativas],
      ["Anexos de exames", anexos ? `${anexos} arquivo(s)` : "—"],
    ] },
    { etapa: 3, titulo: "Responsáveis", itens: [
      ["Responsável 1", r.r1?.nome], ["WhatsApp", r.shared?.telefone], ["E-mail", r.shared?.email],
    ] },
    { etapa: 4, titulo: "Família", itens: [
      ["Com quem mora", c.com_quem_mora_lista], ["Relação dos pais", c.relacao_pais_tag],
    ] },
    { etapa: 5, titulo: "Desenvolvimento", itens: [
      ["Andou", dev.andou], ["Primeiras palavras", dev.primeiras_palavras],
      ["Dificuldades escolares", dev.dificuldades_disciplinas],
    ] },
  ];

  return (
    <div className="space-y-2">
      {blocos.map((b) => (
        <div key={b.etapa} className="rounded-2xl border border-border/60 bg-card/50 p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold">{b.titulo}</p>
            <button type="button" onClick={() => onGoto(b.etapa)} className="text-xs text-brand hover:underline">
              Editar
            </button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {b.itens.map(([k, v]) => (
              <div key={k} className="flex gap-1.5 text-xs">
                <dt className="text-muted-foreground shrink-0">{k}:</dt>
                <dd className="font-medium truncate">{val(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/* ============== ENDEREÇO (CEP) ============== */

function EnderecoCep({ dados, onChange }: { dados: any; onChange: (patch: Record<string, any>) => void }) {
  const [loading, setLoading] = useState(false);
  const cep = dados.cep ?? "";

  async function buscarCep(raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const j = await res.json();
      if (j.erro) { toast.error("CEP não encontrado"); return; }
      onChange({
        cep: clean,
        logradouro: j.logradouro ?? "",
        bairro: j.bairro ?? "",
        cidade: j.localidade ?? "",
        uf: j.uf ?? "",
      });
    } catch {
      toast.error("Falha ao buscar CEP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-secondary/30">
      <h3 className="font-semibold text-sm">Endereço residencial</h3>
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="CEP *">
          <Input
            value={cep}
            placeholder="00000-000"
            inputMode="numeric"
            onChange={(e) => onChange({ cep: e.target.value })}
            onBlur={(e) => buscarCep(e.target.value)}
          />
          {loading && <p className="text-[11px] text-muted-foreground mt-1">Buscando endereço…</p>}
        </Field>
        <Field label="Cidade">
          <Input value={dados.cidade ?? ""} readOnly className="bg-muted/40" />
        </Field>
        <Field label="UF">
          <Input value={dados.uf ?? ""} readOnly className="bg-muted/40" />
        </Field>
      </div>
      <Field label="Logradouro">
        <Input value={dados.logradouro ?? ""} readOnly className="bg-muted/40" />
      </Field>
      <Field label="Bairro">
        <Input value={dados.bairro ?? ""} readOnly className="bg-muted/40" />
      </Field>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Número *">
          <Input value={dados.numero ?? ""} onChange={(e) => onChange({ numero: e.target.value })} />
        </Field>
        <Field label="Complemento">
          <Input value={dados.complemento ?? ""} onChange={(e) => onChange({ complemento: e.target.value })} placeholder="Apto, bloco, referência" />
        </Field>
      </div>
    </div>
  );
}
