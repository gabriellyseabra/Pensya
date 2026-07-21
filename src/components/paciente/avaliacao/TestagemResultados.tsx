import { AvaliacaoTab } from "@/components/prontuario/AvaliacaoTab";
import { PerfilCognitivoTab } from "@/components/paciente/PerfilCognitivoTab";

/**
 * Etapa unificada de Testagem & Resultados.
 * Junta, numa única página, o planejamento da bateria + lançamento de resultados
 * (AvaliacaoTab) e a visualização do perfil cognitivo (PerfilCognitivoTab),
 * eliminando a troca de abas entre "Perfil Cognitivo" e "Síntese & Protocolos".
 */
export function TestagemResultados({ pacienteId }: { pacienteId: string }) {
  return (
    <div className="space-y-8">
      <AvaliacaoTab pacienteId={pacienteId} />
      <div>
        <h3 className="text-base font-semibold mb-3">Perfil cognitivo</h3>
        <PerfilCognitivoTab pacienteId={pacienteId} />
      </div>
    </div>
  );
}
