/**
 * Texto do pedido para gestão e manutenção.
 * A escolha do campo continua em `textoSolicitacaoOs` (`lib/ec/os-detalhe.ts`).
 * Aqui só entram espaço, máscara e o corte de 280 caracteres.
 * Nome de paciente em texto livre não é detectável por esta máscara.
 */
const LIMITE = 280;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const CPF_PONTUADO = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
const TELEFONE = /(?:\+\s?55\s*)?(?:\(\s*\d{2}\s*\)\s*|\d{2}\s+)\d{4,5}[\s-]?\d{4}/g;
const CPF_SOLTO = /\b\d{11}\b/g;

export function prepararSolicitacao(bruto: string) {
  let texto = bruto.replace(/[\s\u00a0]+/g, " ").trim();
  texto = texto.replace(EMAIL, "[e-mail]");
  texto = texto.replace(CPF_PONTUADO, "[cpf]");
  texto = texto.replace(TELEFONE, "[telefone]");
  texto = texto.replace(CPF_SOLTO, "[cpf]");
  if (texto.length <= LIMITE) return texto;
  return texto.slice(0, LIMITE).trimEnd();
}
