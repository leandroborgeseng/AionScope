/**
 * Casos da máscara sem DDD. Números fictícios, sem telefone real.
 * Uso: npx tsx scripts/mascara-c3.mts
 */
import assert from "node:assert/strict";
import { prepararSolicitacao } from "../lib/bot/api/solicitacao";

const mascarados = [
  "ligar para os 99000-1111",
  "OS 3333-4444",
  "OS\t3333-4444",
  "OS  3333-4444",
  "tel 3333-4444",
  "(3333-4444)",
  "OS 3301-3302",
];
const preservados = ["horario 0800-1200", "NS 1234-5678", "patrimônio 12345-6789"];

for (const frase of mascarados) {
  const saida = prepararSolicitacao(frase);
  assert.equal(saida.includes("[telefone]"), true, saida);
  assert.equal(/\d{4}/.test(saida), false, saida);
}
for (const frase of preservados) {
  assert.equal(prepararSolicitacao(frase), frase);
}

console.log(`mascara-c3: ${mascarados.length} mascarados, ${preservados.length} preservados`);
