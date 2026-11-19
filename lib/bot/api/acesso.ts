/**
 * Papel na API do bot. O rótulo deixa de ser só etiqueta nestas rotas:
 * assistência fica no próprio setor; gestão e manutenção enxergam o parque.
 */
import { getDb } from "@/lib/db/client";
import { normalizarChave } from "./chave";

export type ContextoBot = {
  id: string;
  papel: string;
  setores: string[];
};

export function contextoBot(usuarioId: string): ContextoBot {
  const linha = getDb().prepare("SELECT papel FROM bot_usuario WHERE id = ?").get(usuarioId) as
    | { papel: string }
    | undefined;
  const setores = getDb()
    .prepare(
      `SELECT t.nome AS nome
       FROM bot_usuario_setor s
       JOIN bot_setor t ON t.codigo = s.setor_codigo
       WHERE s.usuario_id = ?
       ORDER BY t.nome`,
    )
    .all(usuarioId) as Array<{ nome: string }>;
  return { id: usuarioId, papel: linha?.papel ?? "", setores: setores.map((item) => item.nome) };
}

export function papelAssistencial(papel: string) {
  const chave = normalizarChave(papel);
  return chave === "CHEFIA DE ENFERMAGEM" || chave === "SOLICITANTE ASSISTENCIAL";
}

/** Diretoria/Gestão e Manutenção. Matrícula, solicitação e a visão por setor. */
export function papelGestao(papel: string) {
  const chave = normalizarChave(papel);
  return chave === "DIRETORIA/GESTAO" || chave === "MANUTENCAO";
}
