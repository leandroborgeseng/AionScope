/** Grava o valor do parque e o histórico (P1/P4). Mesmo cálculo do botão "Atualizar da API". */
import { getDb } from "@/lib/db/client";
import { readParqueMeta, writeParqueMeta } from "@/lib/cadastros/store";
import type { ParqueMeta } from "@/lib/cadastros/types";
import { competenciaBRT } from "@/lib/pbi/parque-frescor";
import { resumirValorParqueApi } from "@/lib/pbi/parque-valor";
import type { EquipamentoItem } from "@/lib/pbi/types";

export type ParqueOrigem = "manual" | "agendador";

export type ParqueHistoricoRow = {
  id: number;
  registradoEm: string;
  competencia: string;
  origem: ParqueOrigem;
  valorAnterior: number | null;
  atualizadoEmAnterior: string | null;
  valorNovo: number;
  itensComValor: number;
  itensTotal: number;
  atualizadoPor: string | null;
};

export function gravarValorParque(
  items: EquipamentoItem[],
  opts: { origem: ParqueOrigem; atualizadoPor?: string | null; agora?: Date },
): { meta: ParqueMeta; resumo: ReturnType<typeof resumirValorParqueApi> } {
  const db = getDb();
  const resumo = resumirValorParqueApi(items);
  const valorApi = Math.round(resumo.substituicao.todos.total * 100) / 100;
  const agora = (opts.agora ?? new Date()).toISOString();
  let meta!: ParqueMeta;
  db.transaction(() => {
    const current = readParqueMeta();
    db.prepare(
      `INSERT INTO parque_valor_historico (registrado_em, competencia, origem, valor_anterior, atualizado_em_anterior, valor_novo, itens_com_valor, itens_total, atualizado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(agora, competenciaBRT(agora), opts.origem, current.valorApi, current.atualizadoEm, valorApi, resumo.substituicao.todos.preenchidos, resumo.nTotal, opts.atualizadoPor ?? null);
    db.prepare(
      `INSERT INTO parque_valor_mensal (competencia, valor, itens_com_valor, itens_total, atualizado_em) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(competencia) DO UPDATE SET valor = excluded.valor, itens_com_valor = excluded.itens_com_valor,
         itens_total = excluded.itens_total, atualizado_em = excluded.atualizado_em
       WHERE excluded.atualizado_em >= parque_valor_mensal.atualizado_em`,
    ).run(competenciaBRT(agora), valorApi, resumo.substituicao.todos.preenchidos, resumo.nTotal, agora);
    meta = writeParqueMeta({
      valorSubstituicaoManual: null,
      valorApi,
      fonte: "api",
      escopo: "todos",
      atualizadoEm: agora,
      atualizadoPor: opts.atualizadoPor ?? (opts.origem === "agendador" ? "agendador" : null),
      valorManualReferencia: current.valorManualReferencia ?? null,
      notas: `Soma ValorDeSubstituicao de todos os equipamentos (${resumo.nTotal} itens, ${resumo.substituicao.todos.pctPreenchidos.toFixed(1)}% preenchidos). Médicos (auditoria): ${resumo.substituicao.medicos.total}.`,
    });
  })();
  return { meta, resumo };
}

export function lerHistoricoParque(limite = 24): ParqueHistoricoRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM parque_valor_historico ORDER BY registrado_em DESC, id DESC LIMIT ?")
    .all(limite) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    registradoEm: String(r.registrado_em),
    competencia: String(r.competencia),
    origem: r.origem as ParqueOrigem,
    valorAnterior: (r.valor_anterior as number | null) ?? null,
    atualizadoEmAnterior: (r.atualizado_em_anterior as string | null) ?? null,
    valorNovo: Number(r.valor_novo),
    itensComValor: Number(r.itens_com_valor),
    itensTotal: Number(r.itens_total),
    atualizadoPor: (r.atualizado_por as string | null) ?? null,
  }));
}

export type ParqueMensalRow = { competencia: string; valor: number; itensComValor: number; itensTotal: number; atualizadoEm: string };

export function lerParqueMensal(): ParqueMensalRow[] {
  const rows = getDb().prepare("SELECT * FROM parque_valor_mensal ORDER BY competencia ASC").all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    competencia: String(r.competencia),
    valor: Number(r.valor),
    itensComValor: Number(r.itens_com_valor),
    itensTotal: Number(r.itens_total),
    atualizadoEm: String(r.atualizado_em),
  }));
}
