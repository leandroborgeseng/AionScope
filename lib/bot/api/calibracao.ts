/**
 * Plano de calibração por setor, agregado por mês.
 * A lógica do mês é a de `lib/ec/programadas-mes.ts` (cronograma + periodicidade).
 * O texto de ajuda só existe se `AIONSCOPE_BOT_AJUDA_EFFORT_CALIBRACAO` estiver preenchida.
 */
import { semAcento, texto } from "@/lib/ec/texto";
import { nowInSaoPaulo, parsePbiDate } from "@/lib/pbi/dates";
import { classifyPlanoEc } from "@/lib/pbi/indicadores-os";
import { keepCronogramaPlano, parsePeriodicidadeMeses, plannedMonthsInYear } from "@/lib/pbi/cronograma-anual";
import type { CronogramaItem } from "@/lib/pbi/types";
import { contextoBot, papelAssistencial, papelGestao } from "./acesso";
import { listarApelidos } from "./apelidos";
import { normalizarChave } from "./chave";
import { lerLista } from "./copia";
import { cronogramaNoEscopoBot } from "./escopo";
import { copiaIndisponivel, json } from "./http";
import { decidirSetor, nomeDaChave, respostaDecisaoSetor } from "./setor-match";

export const AJUDA_CALIBRACAO_ENV = "AIONSCOPE_BOT_AJUDA_EFFORT_CALIBRACAO";

export function ajudaCalibracao() {
  const valor = process.env[AJUDA_CALIBRACAO_ENV];
  if (valor == null || valor.trim() === "") return null;
  return valor;
}

function chaveEquipamento(item: CronogramaItem, indice: number) {
  const tag = texto(item.Tag);
  if (tag) return `tag:${semAcento(tag)}`;
  const equipamento = texto(item.Equipamento);
  if (!equipamento && !texto(item.Modelo) && !texto(item.Fabricante)) return `linha:${indice}`;
  return `eq:${semAcento(equipamento)}|${semAcento(item.Modelo)}|${semAcento(item.Fabricante)}`;
}

function mesesDoSetor(itens: CronogramaItem[], chaveSetor: string, ano: number) {
  const porMes = new Map<number, Set<string>>();
  itens.forEach((item, indice) => {
    if (normalizarChave(item.Setor) !== chaveSetor) return;
    if (!cronogramaNoEscopoBot(item)) return;
    if (!keepCronogramaPlano(item.TipoDeManutencao, false)) return;
    if (classifyPlanoEc(item.TipoDeManutencao) !== "Calibração") return;
    const meses = plannedMonthsInYear({
      proxima: parsePbiDate(item.ProximaRealizacao),
      ultima: parsePbiDate(item.DataDaUltima),
      intervalMonths: parsePeriodicidadeMeses(item.Perioridicade),
      year: ano,
    });
    const chave = chaveEquipamento(item, indice);
    for (const mes of meses) {
      if (mes < 0 || mes > 11) continue;
      const grupo = porMes.get(mes) ?? new Set<string>();
      grupo.add(chave);
      porMes.set(mes, grupo);
    }
  });
  return [...porMes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([mes, equipamentos]) => ({
      mes: `${ano}-${String(mes + 1).padStart(2, "0")}`,
      equipamentos: equipamentos.size,
    }));
}

export function consultarCalibracao(request: Request, usuarioId: string) {
  const params = new URL(request.url).searchParams;
  const setor = params.get("setor")?.trim() ?? "";
  const anoBruto = params.get("ano")?.trim() ?? "";
  const ano = anoBruto ? Number(anoBruto) : nowInSaoPaulo().getFullYear();
  if (anoBruto && (!/^\d{4}$/.test(anoBruto) || ano < 2000 || ano > 2100)) {
    return json(400, { ok: false, message: "Ano inválido." });
  }

  const ctx = contextoBot(usuarioId);
  if (papelAssistencial(ctx.papel) && ctx.setores.length === 0) {
    return respostaDecisaoSetor({ tipo: "nao_cadastrado" })!;
  }
  if (!setor && !papelAssistencial(ctx.papel)) return json(400, { ok: false, message: "Informe o setor." });
  const copia = lerLista("cronograma");
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const itens = (copia.itens as CronogramaItem[]).filter(cronogramaNoEscopoBot);
  const ajuda = ajudaCalibracao();
  const base = { fetchedAt: copia.fetchedAt, idadeSegundos: copia.idadeSegundos, comoConsultarNoEffort: ajuda };
  const decisao = decidirSetor({
    assistencial: papelAssistencial(ctx.papel),
    gestao: papelGestao(ctx.papel),
    vinculos: ctx.setores,
    consulta: setor,
    nomesNaCopia: itens.map((item) => item.Setor),
    modo: "unico",
    apelidos: listarApelidos(),
  });
  const especial = respostaDecisaoSetor(decisao, base);
  if (especial) return especial;
  if (decisao.tipo !== "chaves" || decisao.chaves.size !== 1) {
    return json(400, { ok: false, message: "Informe o setor." });
  }
  const chave = [...decisao.chaves][0]!;
  return json(200, {
    ok: true,
    status: "ok",
    setor: nomeDaChave(chave, itens.map((item) => item.Setor)),
    ano,
    meses: mesesDoSetor(itens, chave, ano),
    ...base,
  });
}
