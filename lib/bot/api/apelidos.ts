/**
 * Apelidos de setor da API do bot. Vivem em `bot_setor_apelido`
 * (apelido → nome canônico do Effort). A migration 019 grava CC → Centro Cirúrgico.
 * A comparação é normalizada; um apelido com mais de um nome fica ambíguo.
 */
import { getDb } from "@/lib/db/client";

export type ApelidoSetor = { apelido: string; nome: string };

export function listarApelidos(): ApelidoSetor[] {
  return getDb().prepare("SELECT apelido, nome FROM bot_setor_apelido ORDER BY apelido, nome").all() as ApelidoSetor[];
}
