/**
 * Apelidos de setor da API do bot. Vivem em `bot_setor_apelido`
 * (apelido → nome canônico). A migration 019 grava CC → Centro Cirúrgico.
 * O alvo casa por igualdade ou, se esse nome não existir na cópia, por
 * substring: CENTRO CIRÚRGICO - 10A entra. Um apelido com mais de um nome fica ambíguo.
 */
import { getDb } from "@/lib/db/client";

export type ApelidoSetor = { apelido: string; nome: string };

export function listarApelidos(): ApelidoSetor[] {
  return getDb().prepare("SELECT apelido, nome FROM bot_setor_apelido ORDER BY apelido, nome").all() as ApelidoSetor[];
}
