/**
 * Chave de comparação da API do bot: sem acento, sem caixa e sem espaços extras.
 */
import { semAcento } from "@/lib/ec/texto";

export function normalizarChave(valor: string | null | undefined) {
  return semAcento(valor).replace(/\s+/g, " ").trim();
}
