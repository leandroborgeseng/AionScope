/**
 * Plano de calibração por setor, agregado por mês.
 * A lógica do mês é a de `lib/ec/programadas-mes.ts` (cronograma + periodicidade).
 * O texto de ajuda só existe se `AIONSCOPE_BOT_AJUDA_EFFORT_CALIBRACAO` estiver preenchida.
 */
import { getDb } from "@/lib/db/client";
import { semAcento, texto } from "@/lib/ec/texto";
import { parsePbiDate } from "@/lib/pbi/dates";
import { classifyPlanoEc } from "@/lib/pbi/indicadores-os";
import { keepCronogramaPlano, parsePeriodicidadeMeses, plannedMonthsInYear } from "@/lib/pbi/cronograma-anual";
import type { CronogramaItem } from "@/lib/pbi/types";
import { lerLista } from "./copia";
import { copiaIndisponivel, json } from "./http";

export const AJUDA_CALIBRACAO_ENV = "AIONSCOPE_BOT_AJUDA_EFFORT_CALIBRACAO";
const MSG_NAO_ENCONTRADO = "setor não encontrado";
const MSG_REFINAR = "Informe o nome do setor com mais detalhe.";

export function ajudaCalibracao() {
  const valor = process.env[AJUDA_CALIBRACAO_ENV];
  if (valor == null || valor.trim() === "") return null;
  return valor;
}

function setoresVinculados(usuarioId: string) {
  const linhas = getDb()
    .prepare(
      `SELECT t.nome AS nome
       FROM bot_usuario_setor s
       JOIN bot_setor t ON t.codigo = s.setor_codigo
       WHERE s.usuario_id = ?
       ORDER BY t.nome`,
    )
    .all(usuarioId) as Array<{ nome: string }>;
  return linhas.map((linha) => semAcento(linha.nome)).filter(Boolean);
}

function nomeEffort(originais: Map<string, number>) {
  let escolhido = "";
  let vezes = -1;
  for (const [nome, n] of originais) {
    if (n > vezes || (n === vezes && nome.localeCompare(escolhido, "pt-BR") < 0)) {
      escolhido = nome;
      vezes = n;
    }
  }
  return escolhido.toLocaleUpperCase("pt-BR");
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
    if (semAcento(item.Setor) !== chaveSetor) return;
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
  if (!setor) return json(400, { ok: false, message: "Informe o setor." });
  if (!/^\d{4}$/.test(anoBruto)) return json(400, { ok: false, message: "Ano inválido." });
  const ano = Number(anoBruto);
  if (ano < 2000 || ano > 2100) return json(400, { ok: false, message: "Ano inválido." });

  const copia = lerLista("cronograma");
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const itens = copia.itens as CronogramaItem[];
  const ajuda = ajudaCalibracao();
  const base = { fetchedAt: copia.fetchedAt, idadeSegundos: copia.idadeSegundos, comoConsultarNoEffort: ajuda };

  const vinculados = setoresVinculados(usuarioId);
  const permitidos = vinculados.length ? new Set(vinculados) : null;
  const vistos = new Map<string, Map<string, number>>();
  for (const item of itens) {
    const nome = texto(item.Setor);
    const chave = semAcento(nome);
    if (!chave) continue;
    if (permitidos && !permitidos.has(chave)) continue;
    const nomes = vistos.get(chave) ?? new Map<string, number>();
    nomes.set(nome, (nomes.get(nome) ?? 0) + 1);
    vistos.set(chave, nomes);
  }

  const consulta = semAcento(setor);
  const exatos = vistos.has(consulta) ? [consulta] : [];
  const parecidos = exatos.length
    ? exatos
    : [...vistos.keys()].filter((chave) => chave.includes(consulta));

  if (parecidos.length === 0) {
    return json(404, { ok: false, status: "nao_encontrado", message: MSG_NAO_ENCONTRADO, ...base });
  }
  if (parecidos.length > 5) {
    return json(200, { ok: true, status: "refinar", message: MSG_REFINAR, ...base });
  }
  if (parecidos.length > 1) {
    const candidatos = parecidos
      .map((chave) => ({ setor: nomeEffort(vistos.get(chave)!) }))
      .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"))
      .map((item, indice) => ({ ordem: indice + 1, setor: item.setor }));
    return json(200, { ok: true, status: "ambiguo", candidatos, ...base });
  }

  const chave = parecidos[0]!;
  return json(200, {
    ok: true,
    status: "ok",
    setor: nomeEffort(vistos.get(chave)!),
    ano,
    meses: mesesDoSetor(itens, chave, ano),
    ...base,
  });
}
