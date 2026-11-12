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
export const MSG_MOTIVO_INVALIDO = "Motivo inválido.";
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

/** Frase única do pré-cadastro (A57). Igual para número novo, pendente ou aprovado. */
export const MSG_CONVITE_RECEBIDO = "Recebemos seu cadastro. A Aion Engenharia vai conferir e liberar seu acesso.";
export const MSG_LINK_INATIVO = "Este link não está mais ativo. Fale com a Engenharia Clínica para receber um novo.";
export const MSG_CONVITE_AGORA = "Não foi possível enviar agora. Tente de novo em alguns minutos.";
export const MSG_CONVITE_OFFLINE = "Sem conexão. Verifique a internet e tente de novo.";
export const MSG_CONVITE_ARMADILHA = "Não foi possível confirmar o envio. Atualize a página e tente de novo.";
export const MSG_NOME_VAZIO = "Preencha o nome completo.";
export const MSG_TEL_VAZIO = "Informe seu WhatsApp com DDD.";
export const MSG_TEL_CONFIRME = "Confirme o número.";
export const MSG_TEL_DIVERGE = "Os números não coincidem. Confira o DDD e o número.";
export const MSG_TEL_FORMATO = "Use o DDD e o número, por exemplo (16) 99999-9999.";
export const MSG_EMAIL_VAZIO = "Informe seu e-mail.";
export const MSG_EMAIL_EXEMPLO = "Informe um e-mail válido, como nome@hospital.com.br.";
export const MSG_FUNCAO_VAZIA = "Selecione sua função.";
export const MSG_DESCRICAO_VAZIA = "Descreva sua função.";
export const MSG_SETOR_OBRIGATORIO = "Selecione pelo menos um setor.";
export const MSG_ACEITE_OBRIGATORIO = "Marque o aceite para continuar.";
export const MSG_CARACTERES_PROIBIDOS = "Remova caracteres especiais não permitidos.";

export function msgMaximo(maximo: number) {
  return `Máximo de ${maximo} caracteres.`;
}

export const AVISO_PRIVACIDADE = [
  "A Engenharia Clínica da Aion Engenharia (AionScope) usa estes dados só para liberar e controlar seu acesso ao assistente de consultas de ordens de serviço e equipamentos.",
  "O telefone identifica você no WhatsApp. O e-mail serve para contato sobre o seu acesso. A função e os setores servem para o assistente mostrar só o que é da sua área.",
  "Enviar o cadastro não libera o acesso: a Aion Engenharia confere e aprova cada pessoa. Você pode recusar ou pedir a exclusão dos seus dados a qualquer momento, sem prejuízo: é só mandar uma mensagem para a Aion Engenharia no WhatsApp.",
  "Não pedimos senha, CPF nem dado de paciente.",
] as const;
