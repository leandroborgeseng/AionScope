/**
 * Papel na API do bot. O rótulo deixa de ser só etiqueta nestas rotas:
 * assistência fica no próprio setor; gestão e manutenção enxergam o parque.
 * A permissão é o nome canônico, não a posição em `AIONSCOPE_BOT_PAPEIS`.
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

/** Nomes canônicos. Reordenar ou renomear a lista da env não promove ninguém. */
const CHAVES_GESTAO = new Set(["Diretoria/Gestão", "Manutenção"].map((nome) => normalizarChave(nome)));
const CHAVES_COMPRAS = new Set(["Compras"].map((nome) => normalizarChave(nome)));

export function papelAssistencial(papel: string) {
  const chave = normalizarChave(papel);
  if (CHAVES_GESTAO.has(chave) || CHAVES_COMPRAS.has(chave)) return false;
  return true;
}

/** Diretoria/Gestão e Manutenção. Matrícula, solicitação e a visão por setor. */
export function papelGestao(papel: string) {
  return CHAVES_GESTAO.has(normalizarChave(papel));
}
