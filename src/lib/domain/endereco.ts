/**
 * Endereço brasileiro: formato, máscara de CEP e a lista de UFs.
 *
 * Client-safe e sem dependência, pela mesma razão de `documento.ts`: o
 * diálogo do admin confere enquanto se digita e a rota recusa no servidor, com
 * a MESMA função. O banco reaplica o formato no CHECK `partners_address_shape`
 * (migração 0070); mudou uma regra aqui, mude lá.
 *
 * O CEP é guardado só com os dígitos, a máscara é apresentação.
 */

export type Address = {
  /** 8 dígitos, sem hífen. */
  cep: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  /** UF em maiúsculas, ex.: "SP". */
  state: string;
};

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type Uf = (typeof UFS)[number];

export function isUf(value: string): value is Uf {
  return (UFS as readonly string[]).includes(value);
}

/** "01310100" → "01310-100", aplicada enquanto se digita. */
export function formatCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidCep(value: string): boolean {
  return /^\d{8}$/.test(value.replace(/\D/g, ""));
}

/** Os campos que não podem faltar, na ordem em que aparecem na tela. */
export const REQUIRED_ADDRESS_FIELDS = [
  "cep",
  "street",
  "number",
  "district",
  "city",
  "state",
] as const satisfies readonly (keyof Address)[];

/** Endereço completo e bem formado, a mesma regra do CHECK do banco. */
export function isCompleteAddress(address: Partial<Address> | null | undefined): boolean {
  if (!address) return false;
  if (!isValidCep(address.cep ?? "")) return false;
  if (!isUf(address.state ?? "")) return false;
  return REQUIRED_ADDRESS_FIELDS.every((k) => (address[k] ?? "").trim().length > 0);
}
