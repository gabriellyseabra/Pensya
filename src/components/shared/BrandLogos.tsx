// Co-branding: marca Pensya (sistema) + logo da clínica, lado a lado.
// Usado nas telas voltadas à família (portal, convites, formulário
// público de cadastro) — a família vê tanto o sistema quanto a
// identidade da clínica que a atende.
import { useQuery } from "@tanstack/react-query";
import { clinicaLogoUrl, getOrganizacaoBrandingPublica } from "@/lib/clinica-config";
import { cn } from "@/lib/utils";

type BrandContext =
  | { cadastroToken: string; conviteToken?: never; pacienteId?: never }
  | { conviteToken: string; cadastroToken?: never; pacienteId?: never }
  | { pacienteId: string; cadastroToken?: never; conviteToken?: never }
  | { cadastroToken?: never; conviteToken?: never; pacienteId?: never };

function useClinicaLogo(ctx: BrandContext) {
  const key = ctx.cadastroToken ?? ctx.conviteToken ?? ctx.pacienteId ?? "";
  const { data } = useQuery({
    queryKey: ["organizacao-branding-publica", key],
    queryFn: () => getOrganizacaoBrandingPublica(ctx),
    enabled: !!key,
  });
  return clinicaLogoUrl(data?.logo_path);
}

/** Lockup grande e centralizado: logo Pensya + logo da clínica (se configurada). */
export function PensyaClinicaLogo({ className, ...ctx }: { className?: string } & BrandContext) {
  const clinicaLogo = useClinicaLogo(ctx);
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
export function PensyaClinicaBadge({ className, ...ctx }: { className?: string } & BrandContext) {
  const clinicaLogo = useClinicaLogo(ctx);
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
