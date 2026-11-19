/**
 * Recusa de token (401 e 503 de API desativada).
 * Não grava auditoria, telefone nem o segredo. O log sai no máximo uma vez por minuto.
 */
const JANELA_LOG_MS = 60_000;

let total = 0;
let ultimoLog = 0;

export function anotarRecusaAuth(status: 401 | 405 | 503, agora = Date.now()) {
  total += 1;
  if (agora - ultimoLog < JANELA_LOG_MS) return;
  ultimoLog = agora;
  console.log(`api-bot recusa-auth status=${status} n=${total}`);
}

export function contagemRecusaAuth() {
  return total;
}

export function resetRecusaAuth() {
  total = 0;
  ultimoLog = 0;
}
