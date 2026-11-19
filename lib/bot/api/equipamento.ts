/**
 * Ficha do equipamento, últimas OS e próxima preventiva. Só o cache.
 */
import { semAcento, texto } from "@/lib/ec/texto";
import { parsePbiDate } from "@/lib/pbi/dates";
import { classifyPlanoEc } from "@/lib/pbi/indicadores-os";
import { keepCronogramaPlano, parsePeriodicidadeMeses, plannedMonthsInYear } from "@/lib/pbi/cronograma-anual";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { contextoBot, papelAssistencial, papelGestao } from "./acesso";
import { normalizarChave } from "./chave";
import { lerLista } from "./copia";
import { cronogramaNoEscopoBot, oficinaNoEscopoBot } from "./escopo";
import { copiaIndisponivel, json } from "./http";
import { projetarEquipamento, projetarOs } from "./projecao";
import { respostaDecisaoSetor } from "./setor-match";

function proximaPreventiva(itens: CronogramaItem[], tag: string, agora: Date) {
  const chave = semAcento(tag);
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth();
  let melhor: { ano: number; mes: number; plano: string } | null = null;
  for (const item of itens) {
    if (semAcento(item.Tag) !== chave) continue;
    if (!cronogramaNoEscopoBot(item)) continue;
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

function tagNoEscopo(tagChave: string, osItens: OsAnaliticoItem[], planos: CronogramaItem[]) {
  if (osItens.some((linha) => semAcento(linha.Tag) === tagChave && oficinaNoEscopoBot(linha.Oficina))) return true;
  return planos.some((linha) => {
    if (semAcento(linha.Tag) !== tagChave) return false;
    if (!cronogramaNoEscopoBot(linha)) return false;
    const plano = classifyPlanoEc(linha.TipoDeManutencao);
    return plano === "Preventiva" || plano === "Calibração";
  });
}

export function consultarEquipamento(tag: string, usuarioId: string, agora = new Date()) {
  const ctx = contextoBot(usuarioId);
  if (papelAssistencial(ctx.papel) && ctx.setores.length === 0) {
    return respostaDecisaoSetor({ tipo: "nao_cadastrado" })!;
  }
  const equipamentos = lerLista("equipamentos", agora.getTime());
  if (!equipamentos.ok) {
    return copiaIndisponivel(equipamentos.motivo, equipamentos.motivo === "expirada" ? equipamentos : undefined);
  }
  const chave = semAcento(tag);
  const item = (equipamentos.itens as EquipamentoItem[]).find((eq) => semAcento(eq.Tag) === chave);
  if (!item) return json(404, { ok: false, message: "Não encontrei." });

  const os = lerLista("os-analitico", agora.getTime());
  if (!os.ok && os.motivo === "expirada") return copiaIndisponivel(os.motivo, os);
  const osItens = os.ok ? (os.itens as OsAnaliticoItem[]) : [];
  const cronograma = lerLista("cronograma", agora.getTime());
  if (!cronograma.ok && cronograma.motivo === "expirada" && !tagNoEscopo(chave, osItens, [])) {
    return copiaIndisponivel(cronograma.motivo, cronograma);
  }
  const planos = cronograma.ok ? (cronograma.itens as CronogramaItem[]) : [];
  if (!tagNoEscopo(chave, osItens, planos)) return json(404, { ok: false, message: "Não encontrei." });
  if (papelAssistencial(ctx.papel)) {
    const permitidos = new Set(ctx.setores.map((nome) => normalizarChave(nome)));
    if (!permitidos.has(normalizarChave(item.Setor))) return json(404, { ok: false, message: "Não encontrei." });
  }

  const matriculas = papelGestao(ctx.papel);
  const setores = papelAssistencial(ctx.papel) ? new Set(ctx.setores.map((nome) => normalizarChave(nome))) : null;
  const ultimasOs = os.ok
    ? osItens
        .filter((linha) => semAcento(linha.Tag) === chave && oficinaNoEscopoBot(linha.Oficina))
        .filter((linha) => (setores ? setores.has(normalizarChave(linha.Setor)) : true))
        .sort((a, b) => (parsePbiDate(b.Abertura)?.getTime() ?? 0) - (parsePbiDate(a.Abertura)?.getTime() ?? 0))
        .slice(0, 5)
        .map((linha) => projetarOs(linha, { matriculas }))
    : null;

  const preventiva = cronograma.ok ? proximaPreventiva(planos, tag, agora) : null;

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
