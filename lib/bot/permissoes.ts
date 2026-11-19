/**
 * Assuntos da v1. `indicadores` entra nesta lista quando a rota existir.
 * O papel é rótulo (A15): todo ativo recebe a mesma lista. Um mapa por papel
 * pode substituir o padrão depois, sem migração.
 */
const ASSUNTOS_V1 = ["os", "equipamentos", "calibracao"] as const;

const POR_PAPEL: Readonly<Record<string, readonly string[]>> = {};

export function permissoesPorPapel(papel: string, situacao: string): string[] {
  if (situacao !== "ativo") return [];
  return [...(POR_PAPEL[papel] ?? ASSUNTOS_V1)];
}
