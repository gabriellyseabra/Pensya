/**
 * Lista curada de bancos/carteiras usados no Brasil, com a cor de marca.
 * Serve só para identificar visualmente a conta (badge colorido); a clínica
 * pode subir o logo real se quiser. Não embarcamos logos de terceiros.
 */
export type BancoPreset = { nome: string; cor: string };

export const BANCOS_PRESET: BancoPreset[] = [
  { nome: "Dinheiro / Caixa", cor: "#16a34a" },
  { nome: "Banco do Brasil", cor: "#0038A8" },
  { nome: "Bradesco", cor: "#CC092F" },
  { nome: "Caixa Econômica", cor: "#005CA9" },
  { nome: "Itaú", cor: "#EC7000" },
  { nome: "Santander", cor: "#EC0000" },
  { nome: "Nubank", cor: "#820AD1" },
  { nome: "Inter", cor: "#FF7A00" },
  { nome: "C6 Bank", cor: "#242424" },
  { nome: "Sicoob", cor: "#003641" },
  { nome: "Sicredi", cor: "#3AB54A" },
  { nome: "Banrisul", cor: "#00539F" },
  { nome: "PagBank", cor: "#00A868" },
  { nome: "Mercado Pago", cor: "#00A8E1" },
  { nome: "Stone", cor: "#12B76A" },
  { nome: "InfinitePay", cor: "#7A5CFF" },
  { nome: "Outro", cor: "#64748b" },
];

export function corDoBanco(nome: string | null | undefined): string | undefined {
  if (!nome) return undefined;
  return BANCOS_PRESET.find((b) => b.nome === nome)?.cor;
}
