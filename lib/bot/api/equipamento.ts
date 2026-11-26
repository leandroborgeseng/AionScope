/**
 * Ficha do equipamento, últimas OS e próxima preventiva. Só o cache.
 */
import { parsePbiDate } from "@/lib/pbi/dates";
import { chaveTag, classeCronogramaBot, datasPorTipo, datasPublicas } from "@/lib/pbi/cronograma-datas";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { contextoBot, papelAssistencial, papelGestao } from "./acesso";
import { lerLista } from "./copia";
import { casaRegistroComVinculo } from "./setor-usuario";
import { cronogramaNoEscopoBot, oficinaNoEscopoBot } from "./escopo";
import { copiaIndisponivel, json } from "./http";
import { projetarEquipamento, projetarOs } from "./projecao";
import { respostaDecisaoSetor } from "./setor-match";

function tagNoEscopo(tagChave: string, osItens: OsAnaliticoItem[], planos: CronogramaItem[]) {
  if (!tagChave) return false;
  if (osItens.some((linha) => chaveTag(linha.Tag) === tagChave && oficinaNoEscopoBot(linha.Oficina))) return true;
  return planos.some((linha) => {
    if (chaveTag(linha.Tag) !== tagChave) return false;
    if (!cronogramaNoEscopoBot(linha)) return false;
    const plano = classeCronogramaBot(linha);
    return plano === "Preventiva" || plano === "Calibração" || plano === "TSE";
  });
}

export function consultarEquipamento(tag: string, usuarioId: string, agora = new Date()) {
  const ctx = contextoBot(usuarioId);
  if (papelAssistencial(ctx.papel) && ctx.vinculos.length === 0) {
    return respostaDecisaoSetor({ tipo: "nao_cadastrado" })!;
  }
  const equipamentos = lerLista("equipamentos", agora.getTime());
  if (!equipamentos.ok) {
    return copiaIndisponivel(equipamentos.motivo, equipamentos.motivo === "expirada" ? equipamentos : undefined);
  }
  const chave = chaveTag(tag);
  const item = (equipamentos.itens as EquipamentoItem[]).find((eq) => chaveTag(eq.Tag) === chave);
  if (!item) return json(404, { ok: false, message: "Não encontrei." });

  const os = lerLista("os-analitico", agora.getTime());
  if (!os.ok && os.motivo === "expirada") return copiaIndisponivel(os.motivo, os);
  const osItens = os.ok ? (os.itens as OsAnaliticoItem[]) : [];
  const cronograma = lerLista("cronograma", agora.getTime());
  if (!cronograma.ok && cronograma.motivo === "expirada" && !tagNoEscopo(chave, osItens, [])) {
    return copiaIndisponivel(cronograma.motivo, cronograma);
  }
  const planos = cronograma.ok ? (cronograma.itens as CronogramaItem[]) : [];
  if (!tagNoEscopo(chave, osItens, planos)) {
    const temOs = osItens.some((linha) => chaveTag(linha.Tag) === chave);
    if (temOs) return json(404, { ok: false, message: "Não encontrei." });
  }
  if (!papelGestao(ctx.papel) && ctx.vinculos.length > 0 && !casaRegistroComVinculo(item, ctx.vinculos)) {
    return json(404, { ok: false, message: "Não encontrei." });
  }

  const matriculas = papelGestao(ctx.papel);
  const assistencial = papelAssistencial(ctx.papel);
  const ultimasOs = os.ok
    ? osItens
        .filter((linha) => chaveTag(linha.Tag) === chave && oficinaNoEscopoBot(linha.Oficina))
        .filter((linha) => (assistencial ? casaRegistroComVinculo(linha, ctx.vinculos) : true))
        .sort((a, b) => (parsePbiDate(b.Abertura)?.getTime() ?? 0) - (parsePbiDate(a.Abertura)?.getTime() ?? 0))
        .slice(0, 5)
        .map((linha) => projetarOs(linha, { matriculas }))
    : null;

  const daTag = planos.filter((linha) => chaveTag(linha.Tag) === chave && cronogramaNoEscopoBot(linha));
  const datas = datasPorTipo(daTag, agora);
  const preventiva = datas.preventiva.mes
    ? { mes: datas.preventiva.mes, plano: datas.preventiva.plano }
    : null;

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
    preventiva: datasPublicas(datas.preventiva),
    tse: datasPublicas(datas.tse),
    calibracao: datasPublicas(datas.calibracao),
    proximaPreventiva: preventiva,
    fetchedAt,
    idadeSegundos,
  });
}
