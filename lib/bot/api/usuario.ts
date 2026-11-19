/**
 * Situação do telefone para o bot. A allowlist é o objeto montado aqui.
 */
import { getDb } from "@/lib/db/client";
import { permissoesPorPapel } from "@/lib/bot/permissoes";
import { normalizarTelefone } from "@/lib/bot/telefone";

const ORDEM = ["ativo", "inativo", "pendente", "recusado"] as const;

type SituacaoConhecida = (typeof ORDEM)[number];

type Linha = {
  id: string;
  nome: string;
  papel: string;
  situacao: string;
  setor: string | null;
};

export type FichaUsuario = {
  usuarioId: string | null;
  corpo: Record<string, unknown>;
};

function primeiroNomeDe(nome: string) {
  const parte = nome.trim().split(/\s+/).find(Boolean);
  return parte ?? "";
}

function escolher(linhas: Linha[]) {
  let escolhida: Linha | null = null;
  let rank: number = ORDEM.length;
  for (const linha of linhas) {
    const indice = ORDEM.indexOf(linha.situacao as SituacaoConhecida);
    if (indice < 0) continue;
    if (indice < rank || indice === rank) {
      escolhida = linha;
      rank = indice;
    }
  }
  return escolhida;
}

/** `null` quando o header não vira um telefone. Caso contrário, a ficha allowlist. */
export function consultarSituacao(telefone: unknown): FichaUsuario | null {
  const canonico = normalizarTelefone(telefone);
  if (!canonico) return null;
  const linhas = getDb()
    .prepare(
      `SELECT id, nome, papel, situacao, setor
       FROM bot_usuario
       WHERE telefone_e164 = ?
       ORDER BY criado_em`,
    )
    .all(canonico) as Linha[];
  const escolhida = escolher(linhas);
  if (!escolhida) {
    return {
      usuarioId: null,
      corpo: { situacao: "nao_cadastrado", podeResponder: false, permissoes: permissoesPorPapel("", "nao_cadastrado") },
    };
  }
  const permissoes = permissoesPorPapel(escolhida.papel, escolhida.situacao);
  if (escolhida.situacao !== "ativo") {
    return {
      usuarioId: escolhida.id,
      corpo: { situacao: escolhida.situacao, podeResponder: false, permissoes },
    };
  }
  const setor = escolhida.setor?.trim() ? escolhida.setor.trim() : null;
  return {
    usuarioId: escolhida.id,
    corpo: {
      situacao: "ativo",
      podeResponder: true,
      primeiroNome: primeiroNomeDe(escolhida.nome),
      papel: escolhida.papel,
      setor,
      permissoes,
    },
  };
}
