/**
 * Textos fixos do cadastro do bot. Nenhum deles interpola telefone, e-mail,
 * setor ou outros_setores — a rota pública não distingue número novo de já cadastrado.
 */

export const MSG_JSON = "JSON inválido.";
export const MSG_NOME_INVALIDO = "Nome inválido.";
export const MSG_PAPEL_INVALIDO = "Papel inválido.";
export const MSG_TELEFONE_INVALIDO = "Telefone inválido.";
export const MSG_TELEFONE_APROVADO = "Já existe um cadastro aprovado com este número.";
export const MSG_EMAIL_INVALIDO = "E-mail inválido.";
export const MSG_SETOR_INVALIDO = "Setor inválido.";
export const MSG_OUTROS_SETORES_INVALIDO = "Outros setores inválido.";
export const MSG_DONO_INVALIDO = "Dono inválido.";
export const MSG_CORPO_CADASTRO = "Corpo inválido.";
export const MSG_NAO_ENCONTRADO = "Cadastro não encontrado.";
export const MSG_ACAO_DESCONHECIDA = "Ação inválida.";
export const MSG_ACAO_INVALIDA = "Ação não permitida para a situação atual.";
export const MSG_CORPO_ACAO = "Esta rota só aceita a ação.";
export const MSG_GRAVACAO = "Não foi possível gravar o cadastro.";
export const MSG_AUDITORIA_RECUSADA = "Auditoria recusou o registro.";

/** Recusa do cadastro (A12): igual para fora do cadastro, inativo, pendente ou mal formatado. */
export const RECUSA_CADASTRO = Object.freeze({ permitido: false as const });

/**
 * Única forma de resposta pública sobre o cadastro.
 * Igual para número novo, pendente, aprovado, inativo ou mal formatado. Sem dado.
 */
export const RESPOSTA_PUBLICA_CADASTRO = Object.freeze({
  ok: false as const,
  message: "Não posso atender este número.",
});

export function respostaPublicaCadastro(..._entradas: unknown[]) {
  void _entradas;
  return RESPOSTA_PUBLICA_CADASTRO;
}
