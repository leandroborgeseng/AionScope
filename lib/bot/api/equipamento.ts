/**
 * Ficha do equipamento, últimas OS e próxima preventiva. Só o cache.
 */
import { semAcento, texto } from "@/lib/ec/texto";
import { parsePbiDate } from "@/lib/pbi/dates";
import { classifyPlanoEc } from "@/lib/pbi/indicadores-os";
import { keepCronogramaPlano, parsePeriodicidadeMeses, plannedMonthsInYear } from "@/lib/pbi/cronograma-anual";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { lerLista } from "./copia";
import { copiaIndisponivel, json } from "./http";
import { projetarEquipamento, projetarOs } from "./projecao";

function proximaPreventiva(itens: CronogramaItem[], tag: string, agora: Date) {
  const chave = semAcento(tag);
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth();
  let melhor: { ano: number; mes: number; plano: string } | null = null;
  for (const item of itens) {
    if (semAcento(item.Tag) !== chave) continue;
    if (!keepCronogramaPlano(item.TipoDeManutencao, false)) continue;
    if (classifyPlanoEc(item.TipoDeManutencao) !== "Preventiva") continue;
    const proxima = parsePbiDate(item.ProximaRealizacao);
    const ultima = parsePbiDate(item.DataDaUltima);
    const interval = parsePeriodicidadeMeses(item.Perioridicade);
    const plano = texto(item.PlanoDeManutencao);
    for (const ano of [anoAtual, anoAtual + 1]) {
      for (const mes of plannedMonthsInYear({ proxima, ultima, intervalMonths: interval, year: ano })) {
        if (ano === anoAtual && mes < mesAtual) continue;
        if (!melhor || ano < melhor.ano || (ano === melhor.ano && mes < melhor.mes)) {
          melhor = { ano, mes, plano: plano.length <= 80 ? plano : "" };
        }
      }
    }
  }
  if (!melhor) return null;
  return { mes: `${melhor.ano}-${String(melhor.mes + 1).padStart(2, "0")}`, plano: melhor.plano };
}

export function consultarEquipamento(tag: string, agora = new Date()) {
  const equipamentos = lerLista("equipamentos", agora.getTime());
  if (!equipamentos.ok) {
    return copiaIndisponivel(equipamentos.motivo, equipamentos.motivo === "expirada" ? equipamentos : undefined);
  }
  const chave = semAcento(tag);
  const item = (equipamentos.itens as EquipamentoItem[]).find((eq) => semAcento(eq.Tag) === chave);
  if (!item) return json(404, { ok: false, message: "Não encontrei." });

  const os = lerLista("os-analitico", agora.getTime());
  const ultimasOs = os.ok
    ? (os.itens as OsAnaliticoItem[])
        .filter((linha) => semAcento(linha.Tag) === chave)
        .sort((a, b) => (parsePbiDate(b.Abertura)?.getTime() ?? 0) - (parsePbiDate(a.Abertura)?.getTime() ?? 0))
        .slice(0, 5)
        .map(projetarOs)
    : null;

  const cronograma = lerLista("cronograma", agora.getTime());
  const preventiva = cronograma.ok ? proximaPreventiva(cronograma.itens as CronogramaItem[], tag, agora) : null;

  let fetchedAt = equipamentos.fetchedAt;
  let idadeSegundos = equipamentos.idadeSegundos;
  for (const copia of [os.ok ? os : null, cronograma.ok ? cronograma : null]) {
    if (!copia) continue;
    if (copia.fetchedAt < fetchedAt) fetchedAt = copia.fetchedAt;
    if (copia.idadeSegundos > idadeSegundos) idadeSegundos = copia.idadeSegundos;
  }

  return json(200, {
    ok: true,
    equipamento: projetarEquipamento(item),
    ultimasOs,
    proximaPreventiva: preventiva,
    fetchedAt,
    idadeSegundos,
  });
}
