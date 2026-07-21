import { CampoDef, faixasDoCampo, faixaDoValor } from "@/lib/anamnese-schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  campo: CampoDef;
  value: any;
  onChange: (v: any) => void;
  importado?: boolean;
}

export function CampoAnamnese({ campo, value, onChange, importado }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium">{campo.label}</Label>
        {importado && (
          <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] bg-brand/10 text-brand border-brand/20">
            <Sparkles className="h-2.5 w-2.5" /> Importado
          </Badge>
        )}
      </div>
      {renderControl(campo, value, onChange, importado)}
    </div>
  );
}

function renderControl(c: CampoDef, value: any, onChange: (v: any) => void, importado?: boolean) {
  const ring = importado ? "ring-1 ring-brand/30" : "";
  switch (c.tipo) {
    case "text":
      return <Input className={ring} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={c.placeholder} />;
    case "number":
      return <Input className={ring} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "date":
      return <Input className={ring} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <Textarea className={cn("min-h-[72px] text-sm", ring)} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={c.placeholder} />;
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger className={ring}><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent>{(c.opcoes ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      );
    case "radio":
      return (
        <RadioGroup value={value ?? ""} onValueChange={onChange} className="flex flex-wrap gap-3">
          {(c.opcoes ?? []).map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <RadioGroupItem value={o} /> {o}
            </label>
          ))}
        </RadioGroup>
      );
    case "chips":
    case "multi": {
      const arr: string[] = Array.isArray(value) ? value : [];
      const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
      return (
        <div className="flex flex-wrap gap-1.5">
          {(c.opcoes ?? []).map((o) => {
            const active = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs border transition-colors",
                  active ? "bg-brand text-brand-foreground border-brand" : "bg-muted text-muted-foreground border-transparent hover:bg-accent"
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "scale": {
      const min = c.scaleMin ?? 0;
      const max = c.scaleMax ?? 10;
      const v: number | null = typeof value === "number" ? value : null;
      const faixas = faixasDoCampo(c.escalaLabels);
      const faixaAtual = faixaDoValor(v, faixas);
      return (
        <div className="flex items-center gap-2">
          <Select
            value={faixaAtual}
            onValueChange={(label) => {
              const f = faixas.find((x) => x.label === label);
              if (f) onChange(f.mid);
            }}
          >
            <SelectTrigger className={cn("flex-1", ring)}><SelectValue placeholder="Selecione o nível…" /></SelectTrigger>
            <SelectContent>
              {faixas.map((f) => <SelectItem key={f.label} value={f.label}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={min}
            max={max}
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Math.max(min, Math.min(max, Number(e.target.value))))}
            className={cn("w-20 text-center", ring)}
            placeholder="0–10"
          />
        </div>
      );
    }
    case "boolean":
      return (
        <RadioGroup value={value ? "sim" : value === false ? "nao" : ""} onValueChange={(v) => onChange(v === "sim")} className="flex gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer"><RadioGroupItem value="sim" /> Sim</label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer"><RadioGroupItem value="nao" /> Não</label>
        </RadioGroup>
      );
  }
}
