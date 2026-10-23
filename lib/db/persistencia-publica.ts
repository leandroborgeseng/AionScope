/** Campos com caminhos internos (banco, anexos, volume, env) nunca saem na resposta pública (D4). */
const CAMPOS_INTERNOS = ["databasePath", "databaseFile", "anexosRoot", "evidenciasDir", "railwayVolumeMount", "databasePathEnv"] as const;

export function persistenciaPublica<T extends Record<string, unknown>>(p: T) {
  const copia: Record<string, unknown> = { ...p };
  for (const k of CAMPOS_INTERNOS) delete copia[k];
  return copia as Omit<T, (typeof CAMPOS_INTERNOS)[number]>;
}

