/**
 * CPF e CNPJ: máscara e validação de dígito verificador.
 *
 * Client-safe e sem dependência: a mesma função formata enquanto se digita no
 * admin e recusa o número no servidor. Duas implementações dessa conta é como
 * se descobre que a tela aceitava o que a rota rejeitava.
 *
 * O que é guardado no banco são só os DÍGITOS. Máscara é apresentação — se ela
 * for para o banco, "123.456.789-09" e "12345678909" viram duas pessoas
 * diferentes na hora de conferir um pagamento.
 *
 * A validação é o dígito verificador, não uma consulta à Receita: ela pega o
 * erro que realmente acontece (dígito trocado ao copiar), e não diz nada sobre
 * o CPF existir ou pertencer a quem disse. Para o que precisamos — não mandar
 * PIX para um documento digitado errado — é o bastante.
 */

export type DocKind = "cpf" | "cnpj";

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Aplica a máscara conforme o tamanho — CPF até 11 dígitos, CNPJ acima. */
export function formatDoc(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/**
 * Dígitos verificadores por soma ponderada — o mesmo algoritmo para os dois
 * documentos, mudando só os pesos e onde a base termina.
 */
function checkDigit(base: string, startWeight: number): number {
  let sum = 0;
  let weight = startWeight;
  for (const char of base) {
    sum += Number(char) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11) return false;
  // 111.111.111-11 e companhia passam na conta dos dígitos e são inválidos
  // na prática — é o erro típico de quem preenche um formulário só para
  // seguir adiante.
  if (/^(\d)\1{10}$/.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(d[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === Number(d[10]);
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  if (checkDigit(d.slice(0, 12), 5) !== Number(d[12])) return false;
  return checkDigit(d.slice(0, 13), 6) === Number(d[13]);
}

export function docKind(value: string): DocKind | null {
  const len = onlyDigits(value).length;
  if (len === 11) return "cpf";
  if (len === 14) return "cnpj";
  return null;
}

export function isValidDoc(value: string): boolean {
  const kind = docKind(value);
  if (kind === "cpf") return isValidCpf(value);
  if (kind === "cnpj") return isValidCnpj(value);
  return false;
}

/**
 * Forma canônica para o banco: só dígitos, ou `null` quando o campo está
 * vazio. Documento é opcional no cadastro — o parceiro pode ser cadastrado
 * antes de mandar os dados dele.
 */
export function normalizeDoc(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = onlyDigits(value);
  return d.length > 0 ? d : null;
}
