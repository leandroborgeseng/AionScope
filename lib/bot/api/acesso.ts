/**
 * Papel na API do bot. O rótulo deixa de ser só etiqueta nestas rotas:
 * assistência fica no próprio setor; gestão e manutenção enxergam o parque.
 */
import { getDb } from "@/lib/db/client";
import { PAPEIS_BOT_PADRAO, papeisBot } from "../papeis";
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

const IDX_GESTAO = [0, 3] as const;
const IDX_COMPRAS = [2] as const;

/**
 * A env pode renomear a lista inteira. Com o mesmo tamanho da lista padrão,
 * o lugar (0 gestão, 2 compras, 3 manutenção) acompanha o nome novo.
 * O que não é gestão nem compras fica assistência: chefia, solicitante e
 * qualquer rótulo desconhecido. Sem vínculo, esse papel não consulta.
 */
function chavesNoLugar(indices: readonly number[]) {
  const configurados = papeisBot();
  const mesmaLista = configurados.length === PAPEIS_BOT_PADRAO.length;
  const chaves = new Set<string>();
  for (const indice of indices) {
    const padrao = PAPEIS_BOT_PADRAO[indice];
    if (padrao) chaves.add(normalizarChave(padrao));
    if (mesmaLista && configurados[indice]) chaves.add(normalizarChave(configurados[indice]));
  }
  return chaves;
}

export function papelAssistencial(papel: string) {
  const chave = normalizarChave(papel);
  if (chavesNoLugar(IDX_GESTAO).has(chave)) return false;
  if (chavesNoLugar(IDX_COMPRAS).has(chave)) return false;
  return true;
}

/** Diretoria/Gestão e Manutenção. Matrícula, solicitação e a visão por setor. */
export function papelGestao(papel: string) {
  return chavesNoLugar(IDX_GESTAO).has(normalizarChave(papel));
}
