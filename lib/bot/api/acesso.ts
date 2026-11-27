/**
 * Papel na API do bot. O rótulo deixa de ser só etiqueta nestas rotas:
 * assistência fica no próprio setor; gestão e manutenção enxergam o parque.
 * A permissão é o nome canônico, não a posição em `AIONSCOPE_BOT_PAPEIS`.
 */
import { normalizarChave } from "./chave";
import { resolverSetoresDoUsuario, type VinculoSetor } from "./setor-usuario";

export type ContextoBot = {
  id: string;
  papel: string;
  /** Nomes do vínculo. O texto livre de `bot_usuario.setor` não entra aqui. */
  setores: string[];
  vinculos: VinculoSetor[];
  textoLivre: string | null;
};

export function contextoBot(usuarioId: string): ContextoBot {
  const resolvido = resolverSetoresDoUsuario(usuarioId);
  return {
    id: usuarioId,
    papel: resolvido.papel,
    setores: resolvido.vinculos.map((item) => item.nome).filter((nome) => normalizarChave(nome)),
    vinculos: resolvido.vinculos,
    textoLivre: resolvido.textoLivre,
  };
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
