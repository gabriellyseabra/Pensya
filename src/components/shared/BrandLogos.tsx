// Co-branding: marca Pensya (sistema) + logo da clínica configurada pela
// profissional, lado a lado. Usado nas telas voltadas à família (portal,
// convites, formulário público de cadastro) — a família vê tanto o sistema
// quanto a identidade da clínica que a atende.
import { useQuery } from "@tanstack/react-query";
import { clinicaLogoUrl, getConfiguracaoClinica } from "@/lib/clinica-config";
import { cn } from "@/lib/utils";

function useClinicaLogo() {
  const { data: cfg } = useQuery({ queryKey: ["configuracao-clinica"], queryFn: getConfiguracaoClinica });
  return clinicaLogoUrl(cfg?.logo_path);
}

/** Lockup grande e centralizado: logo Pensya + logo da clínica (se configurada). */
export function PensyaClinicaLogo({ className }: { className?: string }) {
  const clinicaLogo = useClinicaLogo();
  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      <img src="/pensya-logo.svg" alt="Pensya" className="h-full w-auto object-contain" />
      {clinicaLogo && (
        <>
          <span className="h-full w-px bg-border/70" />
          <img src={clinicaLogo} alt="Logo da clínica" className="h-full w-auto max-w-[9rem] object-contain" />
        </>
      )}
    </div>
  );
}

/** Versão compacta (ícones), para cabeçalhos estreitos. */
export function PensyaClinicaBadge({ className }: { className?: string }) {
  const clinicaLogo = useClinicaLogo();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img src="/pensya-icon.svg" alt="Pensya" className="h-9 w-9 shrink-0 object-contain" />
      {clinicaLogo && (
        <>
          <span className="h-6 w-px bg-border/70" />
          <img src={clinicaLogo} alt="Logo da clínica" className="h-9 w-9 shrink-0 rounded-md object-contain" />
        </>
      )}
    </div>
  );
}
