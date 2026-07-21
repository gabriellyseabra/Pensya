// Substitui {{variavel}} ou {{paciente.nome}} no HTML do template
export function renderContratoHtml(html: string, vars: Record<string, any>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    let cur: any = vars;
    for (const p of parts) {
      if (cur == null) return "";
      cur = cur[p];
    }
    if (cur == null) return "";
    if (cur instanceof Date) return cur.toLocaleDateString("pt-BR");
    return String(cur);
  });
}

export const VARIAVEIS_DISPONIVEIS = [
  { key: "paciente.nome", label: "Nome do paciente" },
  { key: "paciente.data_nascimento", label: "Data de nascimento" },
  { key: "paciente.cpf", label: "CPF do paciente" },
  { key: "responsavel.nome", label: "Nome do responsável" },
  { key: "responsavel.cpf", label: "CPF do responsável" },
  { key: "responsavel.email", label: "E-mail do responsável" },
  { key: "responsavel.telefone", label: "Telefone do responsável" },
  { key: "valor_acordado", label: "Valor acordado (R$)" },
  { key: "numero_parcelas", label: "Nº de parcelas" },
  { key: "profissional.nome", label: "Profissional responsável" },
  { key: "modalidade", label: "Modalidade de atendimento" },
  { key: "endereco", label: "Endereço de atendimento" },
  { key: "cidade", label: "Cidade" },
  { key: "data_hoje", label: "Data de hoje" },
  { key: "ano_contrato", label: "Ano do contrato" },
  { key: "clinica.nome", label: "Nome da clínica" },
  { key: "clinica.razao_social", label: "Razão social da clínica" },
  { key: "clinica.cnpj", label: "CNPJ da clínica" },
  { key: "clinica.endereco", label: "Endereço da clínica" },
  { key: "clinica.telefone", label: "Telefone da clínica" },
  { key: "clinica.email", label: "E-mail da clínica" },
];


export const TEMPLATE_EXEMPLO = `<h1 style="text-align:center">Contrato de Prestação de Serviços</h1>
<p><strong>Contratante:</strong> {{responsavel.nome}}, CPF {{responsavel.cpf}}, responsável legal por <strong>{{paciente.nome}}</strong>.</p>
<p><strong>Contratada:</strong> {{clinica.nome}}, CNPJ {{clinica.cnpj}}.</p>
<h3>1. Objeto</h3>
<p>Prestação de serviços terapêuticos de <strong>{{modalidade}}</strong> ao paciente {{paciente.nome}}, sob responsabilidade da profissional {{profissional.nome}}, no endereço {{endereco}}.</p>
<h3>2. Valor e forma de pagamento</h3>
<p>Pelo presente serviço, o contratante pagará à contratada o valor de <strong>R$ {{valor_acordado}}</strong> por sessão.</p>
<h3>3. Frequência</h3>
<p>Os atendimentos terão frequência e duração combinadas previamente entre as partes.</p>
<h3>4. Cancelamento</h3>
<p>Sessões canceladas com menos de 24h de antecedência serão cobradas integralmente.</p>
<p style="margin-top:48px">{{cidade}}, {{data_hoje}}.</p>`;
