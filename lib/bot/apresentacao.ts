/** Textos e filtros da tela /admin/bot-usuarios. Sem banco, sem telefone completo. */

export type EntregaStatus = "pendente" | "enviada" | "falhou";
export type SituacaoCadastro = "pendente" | "ativo" | "inativo" | "recusado";
export type AbaBot = "pendentes" | "cadastrados";

export type UsuarioBot = {
  id: string;
  nome: string;
  papel: string;
  telefone_mascarado: string;
  situacao: SituacaoCadastro;
  dono: string;
  email_mascarado: string | null;
  setor: string | null;
  outros_setores: string | null;
  aprovado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  verificado_em: string | null;
  entrega_status: EntregaStatus;
  entrega_pedido_em: string | null;
  motivo_recusa: string | null;
  rotulo?: string | null;
};

export type EventoAuditoriaTela = {
  id: number;
  criado_em: string;
  acao: string;
  recurso: string;
  status: number;
};

export type FiltroTela = {
  busca: string;
  situacao: "ativo" | "inativo" | "todos";
  papel: string;
  dono: string;
};

export type PessoaConflito = { id: string; nome: string; telefone_mascarado: string };
export type ConflitoGrupo = { pendentes: PessoaConflito[]; aprovados: PessoaConflito[] };

export const TEXTO_VAZIO_PENDENTES = "Nenhuma solicitação pendente.";
export const TEXTO_VAZIO_CADASTRADOS = "Nenhum usuário neste filtro.";
export const TEXTO_ERRO = "Não foi possível carregar. Tentar de novo.";
export const TEXTO_TENTAR = "Tentar de novo";
export const TEXTO_SEM_PERMISSAO = "Você não tem acesso a esta tela.";
export const TEXTO_TOAST_REVELAR = "Número revelado · evento registrado na auditoria.";
export const TEXTO_TOAST_REENVIO =
  'Reenvio pedido. A mensagem sai pelo WhatsApp; o status fica "Envio pendente" até a confirmação.';
export const TEXTO_TOAST_RECUSAR = "Pedido recusado.";
export const TEXTO_PAPEL_PENDENTE = "Papel: definido na aprovação";
export const TEXTO_ESCOLHA_PAPEL = "Escolha o papel para aprovar.";
export const ROTULO_MOTIVO = "Motivo (opcional, uso interno)";
export const TEXTO_AJUDA_MOTIVO = "A pessoa não vê o motivo. Ela recebe só a mensagem padrão.";
export const TEXTO_AJUDA_CONFLITO =
  "Outro pedido ou cadastro usa o mesmo número. Confira antes de aprovar. Um pedido não bloqueia o outro.";
export const MOTIVO_LIMITE = 80;
export const TITULO_RECUSAR = "Recusar vínculo?";
export const TITULO_INATIVAR = "Inativar usuário?";
export const TITULO_REATIVAR = "Reativar usuário?";
export const DURACAO_REVELACAO_MS = 30_000;

export const FILTRO_INICIAL: FiltroTela = { busca: "", situacao: "todos", papel: "", dono: "" };

export function textoRecusar(nome: string) {
  return `${nome} não poderá consultar o bot com este número.`;
}

export function textoInativar(nome: string) {
  return `${nome} deixa de receber respostas imediatamente. O histórico de auditoria permanece.`;
}

export function textoReativar(nome: string) {
  return `${nome} volta a receber respostas do bot.`;
}

export function rotuloEntrega(status: EntregaStatus) {
  if (status === "enviada") return "Mensagem enviada";
  if (status === "falhou") return "Envio falhou";
  return "Envio pendente";
}

export function textoToastAprovar(nome: string, papel: string) {
  return `${nome} aprovada como ${papel}. Entrega: Envio pendente.`;
}

export function textoToastInativar(nome: string) {
  return `${nome} inativado.`;
}

export function textoToastReativar(nome: string) {
  return `${nome} reativado.`;
}

export function podeReenviar(usuario: { situacao: SituacaoCadastro; entrega_status: EntregaStatus }) {
  return usuario.situacao === "ativo" && usuario.entrega_status !== "enviada";
}

export function rotuloSituacao(situacao: SituacaoCadastro) {
  if (situacao === "ativo") return "Ativo";
  if (situacao === "inativo") return "Inativo";
  if (situacao === "recusado") return "Recusado";
  return "Pendente";
}

export function tomSituacao(situacao: SituacaoCadastro): "ok" | "default" | "warn" | "danger" {
  if (situacao === "ativo") return "ok";
  if (situacao === "inativo") return "default";
  if (situacao === "recusado") return "danger";
  return "warn";
}

export function tomEntrega(status: EntregaStatus): "ok" | "warn" | "danger" {
  if (status === "enviada") return "ok";
  if (status === "falhou") return "danger";
  return "warn";
}

export function formatarQuando(iso: string | null) {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

export function rotuloAcao(acao: string) {
  const mapa: Record<string, string> = {
    criar: "Criação",
    aprovar: "Aprovação",
    recusar: "Recusa",
    inativar: "Inativação",
    reativar: "Reativação",
    consulta: "Consulta",
    revelar: "Revelação do número",
    reenviar: "Pedido de reenvio",
  };
  return mapa[acao] ?? acao;
}

function incluiBusca(usuario: UsuarioBot, busca: string) {
  const consulta = busca.trim().toLocaleLowerCase("pt-BR");
  if (!consulta) return true;
  const alvo = [usuario.nome, usuario.setor, usuario.outros_setores, usuario.papel, usuario.dono, usuario.telefone_mascarado]
    .filter((parte): parte is string => Boolean(parte))
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  return alvo.includes(consulta);
}

export function filtrarUsuarios(usuarios: UsuarioBot[], aba: AbaBot, filtro: FiltroTela) {
  return usuarios.filter((usuario) => {
    if (aba === "pendentes" && usuario.situacao !== "pendente") return false;
    if (aba === "cadastrados" && usuario.situacao !== "ativo" && usuario.situacao !== "inativo") return false;
    if (aba === "cadastrados" && filtro.situacao !== "todos" && usuario.situacao !== filtro.situacao) return false;
    if (aba !== "pendentes" && filtro.papel && usuario.papel !== filtro.papel) return false;
    if (filtro.dono && usuario.dono !== filtro.dono) return false;
    return incluiBusca(usuario, filtro.busca);
  });
}

export function temConflito(id: string, conflito: ConflitoGrupo | undefined) {
  if (!conflito) return false;
  return conflito.pendentes.some((item) => item.id !== id) || conflito.aprovados.length > 0;
}

export function divergeRotulo(rotulo: string | null | undefined, nome: string) {
  if (!rotulo?.trim()) return false;
  return rotulo.trim() !== nome.trim();
}
