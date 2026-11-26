/**
 * Plano de calibração por setor, agregado por mês.
 * A lógica do mês é a de `lib/ec/programadas-mes.ts` (cronograma + periodicidade).
 * O texto de ajuda só existe se `AIONSCOPE_BOT_AJUDA_EFFORT_CALIBRACAO` estiver preenchida.
 */
import { semAcento, texto } from "@/lib/ec/texto";
import { nowInSaoPaulo, parsePbiDate } from "@/lib/pbi/dates";
import { parsePeriodicidadeMeses, plannedMonthsInYear } from "@/lib/pbi/cronograma-anual";
import { classeCronogramaBot, datasPorTipo, datasPublicas, chaveTag } from "@/lib/pbi/cronograma-datas";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { contextoBot, papelAssistencial, papelGestao } from "./acesso";
import { casaRegistroComVinculo } from "./setor-usuario";
import { listarApelidos } from "./apelidos";
import { normalizarChave } from "./chave";
import { lerLista } from "./copia";
import { cronogramaNoEscopoBot, oficinaNoEscopoBot } from "./escopo";
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

function ehCalibracao(item: CronogramaItem) {
  return classeCronogramaBot(item) === "Calibração";
}

function equipamentosDoSetor(itens: CronogramaItem[], aceita: (item: CronogramaItem) => boolean, agora: Date) {
  const grupos = new Map<string, CronogramaItem[]>();
  const nomes = new Map<string, { tag: string; equipamento: string }>();
  itens.forEach((item, indice) => {
    if (!aceita(item)) return;
    if (!cronogramaNoEscopoBot(item) || !ehCalibracao(item)) return;
    const tag = texto(item.Tag);
    const chave = chaveTag(tag) || `linha:${indice}`;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(item);
    grupos.set(chave, grupo);
    if (!nomes.has(chave)) nomes.set(chave, { tag, equipamento: texto(item.Equipamento) });
  });
  return [...grupos.entries()]
    .map(([chave, linhas]) => {
      const datas = datasPorTipo(linhas, agora);
      const nome = nomes.get(chave)!;
      return {
        tag: nome.tag,
        equipamento: nome.equipamento,
        ...datasPublicas(datas.calibracao),
      };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag, "pt-BR") || a.equipamento.localeCompare(b.equipamento, "pt-BR"));
}

function mesesDoSetor(itens: CronogramaItem[], aceita: (item: CronogramaItem) => boolean, ano: number) {
  const porMes = new Map<number, Set<string>>();
  const grupos = new Map<string, CronogramaItem[]>();
  itens.forEach((item, indice) => {
    if (!aceita(item) || !cronogramaNoEscopoBot(item) || !ehCalibracao(item)) return;
    const chave = chaveTag(texto(item.Tag)) || `linha:${indice}`;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(item);
    grupos.set(chave, grupo);
  });
  const agora = nowInSaoPaulo();
  for (const linhas of grupos.values()) {
    if (!datasPorTipo(linhas, agora).calibracao.proxima) continue;
    linhas.forEach((item, indice) => {
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
  }
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
  const assistencial = papelAssistencial(ctx.papel);
  if (assistencial && ctx.vinculos.length === 0) {
    return respostaDecisaoSetor({ tipo: "nao_cadastrado" })!;
  }
  if (!setor && !papelAssistencial(ctx.papel)) return json(400, { ok: false, message: "Informe o setor." });
  const copia = lerLista("cronograma");
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const os = lerLista("os-analitico");
  const parque = lerLista("equipamentos");
  const itens = copia.itens as CronogramaItem[];
  const nomes: Array<string | null | undefined> = [];
  if (os.ok) {
    for (const item of os.itens as OsAnaliticoItem[]) {
      if (oficinaNoEscopoBot(item.Oficina)) nomes.push(item.Setor);
    }
  }
  if (parque.ok) for (const item of parque.itens as EquipamentoItem[]) nomes.push(item.Setor);
  for (const item of itens) {
    if (cronogramaNoEscopoBot(item)) nomes.push(item.Setor);
  }
  const ajuda = ajudaCalibracao();
  const base = { fetchedAt: copia.fetchedAt, idadeSegundos: copia.idadeSegundos, comoConsultarNoEffort: ajuda };
  const noSetor = itens.filter(cronogramaNoEscopoBot);
  if (assistencial) {
    if (ctx.vinculos.length > 1) {
      const candidatos = ctx.vinculos
        .map((item) => (item.nome || item.codigo).toLocaleUpperCase("pt-BR"))
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((nome, indice) => ({ ordem: indice + 1, setor: nome }));
      return json(200, { ok: true, status: "ambiguo", candidatos, ...base });
    }
    const aceita = (item: CronogramaItem) => casaRegistroComVinculo(item, ctx.vinculos);
    const nome = ctx.vinculos[0]!;
    return json(200, {
      ok: true,
      status: "ok",
      setor: (nome.nome || nome.codigo).toLocaleUpperCase("pt-BR"),
      ano,
      meses: mesesDoSetor(noSetor, aceita, ano),
      equipamentos: equipamentosDoSetor(noSetor, aceita, nowInSaoPaulo()),
      ...base,
    });
  }
  const gestao = papelGestao(ctx.papel);
  const restrito = !gestao && ctx.vinculos.length > 0;
  const nomesBusca = restrito
    ? nomes.filter((nome) => casaRegistroComVinculo({ Setor: nome ?? "" }, ctx.vinculos))
    : nomes;
  const decisao = decidirSetor({
    assistencial: false,
    gestao,
    vinculos: restrito ? [] : ctx.setores,
    consulta: setor,
    nomesNaCopia: nomesBusca,
    modo: "unico",
    apelidos: listarApelidos(),
  });
  const especial = respostaDecisaoSetor(decisao, base);
  if (especial) return especial;
  if (decisao.tipo !== "chaves" || decisao.chaves.size !== 1) {
    return json(400, { ok: false, message: "Informe o setor." });
  }
  const chave = [...decisao.chaves][0]!;
  const aceita = (item: CronogramaItem) => normalizarChave(item.Setor) === chave;
  return json(200, {
    ok: true,
    status: "ok",
    setor: nomeDaChave(chave, nomes),
    ano,
    meses: mesesDoSetor(noSetor, aceita, ano),
    equipamentos: equipamentosDoSetor(noSetor, aceita, nowInSaoPaulo()),
    ...base,
  });
}
