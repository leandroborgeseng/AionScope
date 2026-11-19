/**
 * Texto do pedido para gestão e manutenção.
 * A escolha do campo continua em `textoSolicitacaoOs` (`lib/ec/os-detalhe.ts`).
 * Aqui só entram espaço, máscara e o corte de 280 caracteres.
 * Nome de paciente em texto livre não é detectável por esta máscara.
 *
 * A máscara roda antes do corte. O corte não parte `[cpf]`, `[telefone]` nem
 * `[e-mail]`, e não termina no meio de uma sequência de dígitos.
 *
 * Heurística, nesta ordem:
 * 1. E-mail `local@domínio`, com ou sem TLD (`nome@intranet` inclusive).
 * 2. Telefone com formato: `+55` ou `55` + DDD, DDD entre parênteses,
 *    `DD NNNNN-NNNN`, `DD-NNNNN-NNNN`, `DD 9 NNNN-NNNN`, tronco `0DD`
 *    e `NNNNN-NNNN` / `NNNN-NNNN` sem DDD.
 * 3. Onze dígitos contínuos: DDD da Anatel e o assinante começando em `9`
 *    → `[telefone]`, mesmo se o dígito verificador de CPF também fechar.
 *    Sem esse formato, CPF com os dois dígitos verificadores válidos
 *    → `[cpf]`. DDD válido que não é celular nem CPF → `[telefone]`.
 *    Os outros 11 dígitos → `[cpf]`, para não deixar o número à vista.
 * 4. CPF desenhado com separador (`NNN.NNN.NNN-NN`, `NNN NNN NNN NN`,
 *    `NNN.NNN.NNN.NN`, `NNNNNNNNN-NN`) → `[cpf]` pelo formato.
 */
const LIMITE = 280;
const MARCADORES = ["[telefone]", "[e-mail]", "[cpf]"];

/** DDDs em uso (Anatel). O 3º dígito 9 com um destes é celular, não CPF. */
const DDDS = new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(
    " ",
  ),
);

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*/gi;
const TEL_PAIS = /(?<!\d)\+?\s*55[\s.-]*\(?\s*\d{2}\s*\)?[\s.-]*(?:9[\s.-]+)?\d{4,5}[\s.-]?\d{4}(?!\d)/gi;
const TEL_PAREN = /(?<!\d)\(\s*\d{2}\s*\)[\s.-]*(?:9[\s.-]+)?\d{4,5}[\s.-]?\d{4}(?!\d)/gi;
const TEL_DDD = /(?<!\d)0?\d{2}[\s.-]+(?:9[\s.-]+)?\d{4,5}[\s.-]?\d{4}(?!\d)/gi;
const TEL_SEM_DDD = /(?<!\d)\d{4,5}-\d{4}(?!\d)/g;
const TEL_PAIS_SOLTO = /(?<!\d)\+?55\d{10,11}(?!\d)/g;
const CPF_SEPARADO = /(?<!\d)\d{3}(?:[.\s]\d{3}){2}[-.\s]\d{2}(?!\d)|(?<!\d)\d{9}-\d{2}(?!\d)/g;
const ONZE = /(?<!\d)\d{11}(?!\d)/g;

function cpfValido(d: string) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const n = [...d].map(Number);
  const dv = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += n[i]! * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === n[9] && dv(10) === n[10];
}

/** 11 dígitos contínuos. Celular (DDD válido + 9) ganha do CPF. */
export function rotuloOnzeDigitos(d: string): "[telefone]" | "[cpf]" {
  if (DDDS.has(d.slice(0, 2)) && d[2] === "9") return "[telefone]";
  if (cpfValido(d)) return "[cpf]";
  if (DDDS.has(d.slice(0, 2))) return "[telefone]";
  return "[cpf]";
}

function mascarar(texto: string) {
  return texto
    .replace(EMAIL, "[e-mail]")
    .replace(TEL_PAIS, "[telefone]")
    .replace(TEL_PAREN, "[telefone]")
    .replace(TEL_DDD, "[telefone]")
    .replace(TEL_SEM_DDD, "[telefone]")
    .replace(TEL_PAIS_SOLTO, "[telefone]")
    .replace(CPF_SEPARADO, "[cpf]")
    .replace(ONZE, (m) => rotuloOnzeDigitos(m));
}

function cortar(texto: string) {
  if (texto.length <= LIMITE) return texto;
  let corte = LIMITE;
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const marcador of MARCADORES) {
      const idx = texto.lastIndexOf(marcador, Math.max(0, corte - 1));
      if (idx >= 0 && idx < corte && idx + marcador.length > corte) {
        corte = idx;
        mudou = true;
      }
    }
    if (corte > 0 && corte < texto.length && /\d/.test(texto[corte - 1]!) && /\d/.test(texto[corte]!)) {
      while (corte > 0 && /\d/.test(texto[corte - 1]!)) corte--;
      mudou = true;
    }
  }
  return texto.slice(0, corte).trimEnd();
}

export function prepararSolicitacao(bruto: string) {
  const texto = bruto.replace(/[\s\u00a0]+/g, " ").trim();
  return cortar(mascarar(texto));
}
