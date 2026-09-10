/**
 * Snapshot one-shot para reunião — não é feature de produto.
 * Uso: npx tsx scripts/_snapshot-indicadores-reuniao.ts
 */
import { readFileSync } from "fs";
import { isSituacaoTerceiro } from "../lib/cadastros/terceiros";
import { fetchPbi } from "../lib/pbi/client";
import { nowInSaoPaulo, parsePbiDate, toApiDateTime } from "../lib/pbi/dates";
import { isCorretiva, isPreventiva } from "../lib/pbi/filters";
import {
  buildGapPreventiva,
  gapPreventivaJanelaOperacional,
} from "../lib/pbi/gap-preventiva";
import { cronogramaStatus } from "../lib/pbi/indicators";
import { classifyPlanoEc } from "../lib/pbi/indicadores-os";
import { buildManutencoesPlanejadasExecutadas } from "../lib/pbi/manutencoes-planejadas";
import { buildMedicalIndex, isEquipamentoMedico, linkedToMedicalPark } from "../lib/pbi/medical";
import { isOsAberta } from "../lib/pbi/sala";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem, PbiResult } from "../lib/pbi/types";
import {
  osFechamentoDate,
  rollingYearRange,
  VOLUME_EC_PERIODO_API,
  VOLUME_EC_TIPO_API,
} from "../lib/pbi/volume-ec";

for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

function fail<T>(name: string, r: PbiResult<T>): asserts r is Extract<PbiResult<T>, { ok: true }> {
  if (!r.ok) {
    console.error(name + "_FAIL", r.message ?? r);
    process.exit(1);
  }
}

function hasTag(os: OsAnaliticoItem) {
  const t = (os.Tag ?? "").trim().toLocaleUpperCase("pt-BR");
  return Boolean(t) && t !== "NÃO INFORMADO" && t !== "NAO INFORMADO";
}

function hoursBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 3_600_000;
}

async function main() {
  const today = nowInSaoPaulo();
  const range = rollingYearRange(today);
  const gapJanela = gapPreventivaJanelaOperacional(today);

  const eqParams = new URLSearchParams({
    apenasAtivos: "false",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "false",
  });
  const osParams = new URLSearchParams({
    periodo: VOLUME_EC_PERIODO_API,
    qtdPorPagina: "100000",
    tipoManutencao: VOLUME_EC_TIPO_API,
    dataInicio: `${range.fromISO}T00:00:00`,
    dataFim: `${range.toISO}T23:59:59`,
  });
  // Igual use-manutencoes-planejadas: ±12 meses além do gráfico (API filtra ProximaRealizacao).
  const cronoBufFrom = new Date(range.start.getFullYear(), range.start.getMonth() - 12, 1);
  const cronoBufTo = new Date(range.end.getFullYear(), range.end.getMonth() + 13, 0);
  const cronoBufFromISO = `${cronoBufFrom.getFullYear()}-${String(cronoBufFrom.getMonth() + 1).padStart(2, "0")}-01`;
  const cronoBufToISO = `${cronoBufTo.getFullYear()}-${String(cronoBufTo.getMonth() + 1).padStart(2, "0")}-${String(cronoBufTo.getDate()).padStart(2, "0")}`;

  const cronoParams = new URLSearchParams({
    dataInicio: toApiDateTime(cronoBufFromISO),
    dataFim: toApiDateTime(cronoBufToISO, true),
  });
  const cronoWideParams = new URLSearchParams({
    dataInicio: toApiDateTime(gapJanela.from),
    dataFim: toApiDateTime(gapJanela.to, true),
  });

  console.error("fetching…", {
    range: range.label,
    from: range.fromISO,
    to: range.toISO,
    cronoBuf: { from: cronoBufFromISO, to: cronoBufToISO },
    gapJanela,
  });

  const [eqR, osR, cronoR, cronoWideR] = await Promise.all([
    fetchPbi<EquipamentoItem[]>("equipamentos", eqParams),
    fetchPbi<OsAnaliticoItem[]>("os-analitico", osParams),
    fetchPbi<CronogramaItem[]>("cronograma", cronoParams),
    fetchPbi<CronogramaItem[]>("cronograma", cronoWideParams),
  ]);

  fail("eq", eqR);
  fail("os", osR);
  fail("crono", cronoR);
  fail("cronoWide", cronoWideR);

  const eqs = eqR.data as EquipamentoItem[];
  const osAll = osR.data as OsAnaliticoItem[];
  const crono = cronoR.data as CronogramaItem[];
  const cronoWide = cronoWideR.data as CronogramaItem[];

  const med = buildMedicalIndex(eqs);
  const medicos = eqs.filter(isEquipamentoMedico);

  const statusBuckets = new Map<string, number>();
  for (const e of medicos) {
    const s = (e.Status ?? "").trim() || "(vazio)";
    statusBuckets.set(s, (statusBuckets.get(s) ?? 0) + 1);
  }
  const ativos = medicos.filter((e) => (e.Status ?? "").toLocaleUpperCase("pt-BR") === "ATIVO");
  const terceiros = medicos.filter((e) => isSituacaoTerceiro(e.Situacao));

  function isMedOs(os: OsAnaliticoItem) {
    return linkedToMedicalPark(os.Tag, null, med.tags, med.ids);
  }

  function inRange(d: Date | null) {
    if (!d) return false;
    return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
  }

  const osMed = osAll.filter(isMedOs);
  const corretivas = osMed.filter((o) => isCorretiva(o.TipoDeManutencao));
  const preventivasOs = osMed.filter((o) => isPreventiva(o.TipoDeManutencao));

  const corretivasAbertas = corretivas.filter((o) => isOsAberta(o));
  const corretivasAbertasComTag = corretivasAbertas.filter(hasTag);
  const tagsEmManut = new Set(
    corretivasAbertasComTag.map((o) => o.Tag.trim().toLocaleUpperCase("pt-BR")),
  );
  const corretivasConcluidas = corretivas.filter((o) => inRange(osFechamentoDate(o)));

  // Referência: corretivas abertas sem filtro médico (só isCorretiva + aberta)
  const corretivasAbertasAll = osAll.filter((o) => isCorretiva(o.TipoDeManutencao) && isOsAberta(o));

  const tempos: number[] = [];
  for (const o of corretivas) {
    const ab = parsePbiDate(o.Abertura);
    const at = parsePbiDate(o.DataDoAtendimento);
    if (!ab || !at || !inRange(ab)) continue;
    const h = hoursBetween(ab, at);
    if (h >= 0 && h < 365 * 24) tempos.push(h);
  }
  const tempoMedioH = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;

  const byTag = new Map<string, number>();
  for (const o of corretivas) {
    if (!hasTag(o)) continue;
    const ab = parsePbiDate(o.Abertura);
    if (!inRange(ab)) continue;
    const k = o.Tag.trim().toLocaleUpperCase("pt-BR");
    byTag.set(k, (byTag.get(k) ?? 0) + 1);
  }
  const recorrentesTags = [...byTag.entries()].filter(([, n]) => n >= 2);
  const recorrentesOsCount = recorrentesTags.reduce((s, [, n]) => s + n, 0);

  const manut = buildManutencoesPlanejadasExecutadas(crono, osAll, range);
  const prevPlanejado = manut.planejadas.filter((r) => r.tipo === "Preventiva").length;
  const prevExecutado = manut.executadas.filter((r) => r.tipo === "Preventiva").length;
  const prevCumpr = prevPlanejado > 0 ? Math.min(prevPlanejado, prevExecutado) / prevPlanejado : null;

  const prevFechadasPeriodo = preventivasOs.filter((o) => inRange(osFechamentoDate(o))).length;

  const calibLines = cronoWide.filter((i) => {
    const t = classifyPlanoEc(i.TipoDeManutencao) || classifyPlanoEc(i.PlanoDeManutencao);
    return t === "Calibração";
  });
  const calibEnriched = calibLines.map(cronogramaStatus);
  const calibAtrasadas = calibEnriched.filter((i) => i.statusCalculado === "atrasado");
  const calibVenceEm = calibEnriched.filter((i) => i.statusCalculado === "vence_em");
  const calibEmDia = calibEnriched.filter((i) => i.statusCalculado === "em_dia");
  const calibSemData = calibEnriched.filter((i) => i.statusCalculado === "sem_data");
  const tagSet = (items: typeof calibEnriched) =>
    new Set(items.map((i) => (i.Tag || "").trim()).filter(Boolean)).size;

  const gap = buildGapPreventiva(eqs, cronoWide, gapJanela);

  const eqKeys = new Set<string>();
  for (const e of medicos.slice(0, 80)) {
    for (const k of Object.keys(e)) eqKeys.add(k);
  }
  const calibRelatedKeys = [...eqKeys].filter((k) => /calib|valid|venc/i.test(k));

  console.log(
    JSON.stringify(
      {
        hoje: today.toISOString().slice(0, 10),
        periodo: {
          label: range.label,
          from: range.fromISO,
          to: range.toISO,
          months: range.months.length,
        },
        api: {
          equipamentos: eqs.length,
          os: osAll.length,
          cronograma: crono.length,
          cronogramaWide: cronoWide.length,
        },
        medical: { totalApi: med.total, medicos: med.medicos, outros: med.outros },
        statusTop: [...statusBuckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
        indicadores: {
          "1_total_equipamentos_medicos": med.medicos,
          "2_ativos_Status_ATIVO": ativos.length,
          "2b_nao_ativos": med.medicos - ativos.length,
          "3_em_manutencao_tags_corretiva_aberta": tagsEmManut.size,
          "3b_os_corretivas_abertas_com_tag": corretivasAbertasComTag.length,
          "3c_os_corretivas_abertas_todas": corretivasAbertas.length,
          "4_prev_previstas_cronograma_rolling": prevPlanejado,
          "5_prev_realizadas_os_fechadas_rolling": prevExecutado,
          "5b_prev_os_fechadas_medical_isPreventiva": prevFechadasPeriodo,
          "6_pct_cumprimento_prev": prevCumpr == null ? null : Math.round(prevCumpr * 1000) / 10,
          "6b_all_planos": {
            planejado: manut.totalPlanejado,
            executado: manut.totalExecutado,
            pct: manut.cumprimentoLabel,
          },
          "7_corretivas_abertas_stock": corretivasAbertas.length,
          "7b_corretivas_abertas_sem_filtro_medico": corretivasAbertasAll.length,
          "8_corretivas_concluidas_rolling": corretivasConcluidas.length,
          "9_tempo_medio_atendimento_h":
            tempoMedioH == null ? null : Math.round(tempoMedioH * 10) / 10,
          "9b_n_com_DataDoAtendimento": tempos.length,
          "10_tags_recorrentes_ge2": recorrentesTags.length,
          "10b_os_nessas_tags": recorrentesOsCount,
          "11_terceiros_situacao": terceiros.length,
          "12_calib_atrasadas_linhas": calibAtrasadas.length,
          "12b_calib_atrasadas_tags": tagSet(calibAtrasadas),
          "13_calib_vence_em_linhas": calibVenceEm.length,
          "13b_calib_vence_em_tags": tagSet(calibVenceEm),
          "13c_calib_em_dia": calibEmDia.length,
          "13d_calib_sem_data": calibSemData.length,
          "13e_calib_linhas_total": calibLines.length,
        },
        gap: {
          parqueMedicoComTag: gap.parqueMedicoComTag,
          comPreventiva: gap.comPreventiva,
          semPreventiva: gap.semPreventiva.length,
          janela: gap.janela,
        },
        calibRelatedKeys,
        manutModo: {
          modo: manut.modo,
          pctComTag: Math.round(manut.pctComTag * 1000) / 10,
          semData: manut.semDataPlanejada,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
