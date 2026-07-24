import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { gerarDocumentoHTML, imprimirDocumento, textoParaHtml } from "@/lib/documento-avulso";

type Modelo = { key: string; titulo: string; corpo: string };

const MODELOS: Modelo[] = [
  {
    key: "declaracao", titulo: "Declaração de comparecimento",
    corpo: "Declaro, para os devidos fins, que {nome} compareceu a atendimento nesta clínica em {data}.\n\nPor ser expressão da verdade, firmo a presente declaração.",
  },
  {
    key: "escolar", titulo: "Declaração para fins escolares",
    corpo: "Declaro, para os devidos fins escolares, que {nome} encontra-se em acompanhamento psicopedagógico nesta clínica, com atendimentos regulares.\n\nColoco-me à disposição para os esclarecimentos que se fizerem necessários.",
  },
  {
    key: "encaminhamento", titulo: "Encaminhamento",
    corpo: "Encaminho {nome} para avaliação/atendimento com [especialidade], tendo em vista [descrever o motivo do encaminhamento].\n\nAgradeço a atenção e permaneço à disposição para a troca de informações que favoreçam o acompanhamento.",
  },
  {
    key: "autorizacao", titulo: "Autorização de uso de imagem",
    corpo: "Eu, [nome do responsável], autorizo o uso da imagem de {nome} para fins de [descrever a finalidade], sem qualquer ônus.\n\nEsta autorização é concedida de forma livre e esclarecida.",
  },
  {
    key: "parecer", titulo: "Parecer / relatório breve",
    corpo: "{nome} encontra-se em acompanhamento nesta clínica desde [data de início]. Ao longo do processo, observou-se [descrever brevemente].\n\nRecomenda-se [orientações e recomendações].\n\nColoco-me à disposição para esclarecimentos.",
  },
  {
    key: "consentimento", titulo: "Termo de consentimento",
    corpo: "Eu, [nome do responsável], declaro estar ciente e de acordo com [descrever o procedimento/serviço] a ser realizado com {nome}.\n\nDeclaro ter recebido as informações necessárias e concordo com a sua realização.",
  },
];

function dataExtenso(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

export function DocumentosAvulsos({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [modeloKey, setModeloKey] = useState(MODELOS[0].key);
  const [titulo, setTitulo] = useState(MODELOS[0].titulo);
  const [corpo, setCorpo] = useState(MODELOS[0].corpo);
  const [nome, setNome] = useState("");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [gerando, setGerando] = useState(false);

  function selecionar(k: string) {
    const m = MODELOS.find((x) => x.key === k) ?? MODELOS[0];
    setModeloKey(k);
    setTitulo(m.titulo);
    setCorpo(m.corpo);
  }

  function aplicarVars(txt: string): string {
    return txt
      .replace(/\{nome\}/g, nome.trim() || "____________")
      .replace(/\{data\}/g, dataExtenso(data));
  }

  async function gerar() {
    setGerando(true);
    try {
      const html = await gerarDocumentoHTML({
        titulo: aplicarVars(titulo),
        corpoHtml: textoParaHtml(aplicarVars(corpo)),
      });
      imprimirDocumento(html);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar o documento");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Documentos avulsos</DialogTitle></DialogHeader>

        <p className="text-xs text-muted-foreground">
          Escolha um modelo, ajuste o texto e gere o PDF com o cabeçalho da clínica. Use <code>{"{nome}"}</code> e
          <code>{" {data}"}</code> — são preenchidos com os campos abaixo. Trechos entre [colchetes] você completa no texto.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label className="text-xs">Modelo</Label>
            <Select value={modeloKey} onValueChange={selecionar}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELOS.map((m) => <SelectItem key={m.key} value={m.key}>{m.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nome ({"{nome}"})</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Paciente / pessoa" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Data ({"{data}"})</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Texto do documento</Label>
          <Textarea rows={8} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={gerar} disabled={gerando} className="gradient-brand text-brand-foreground">
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}Gerar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
