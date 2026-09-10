/**
 * Diagnóstico: equipamentos ativos com Tag sem Preventiva / Calibração / TSE no cronograma.
 * Uso: npx tsx scripts/_diag-gap-plano-ec.ts
 */
import { readFileSync } from "fs";
import { fetchPbi } from "../lib/pbi/client";
import { toUpstreamParams, type DashboardFilters } from "../lib/pbi/filters";
import { classifyPlanoEc, type PlanoEcTipo } from "../lib/pbi/indicadores-os";
import { isEquipamentoMedico, tipoCadastro } from "../lib/pbi/medical";
import {
  buildPlanosByTagLoose,
  critRank,
  emptyPlanos,
  type PlanoSet,
} from "../lib/pbi/gap-preventiva";
import type { CronogramaItem, EquipamentoItem } from "../lib/pbi/types";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

function filled(v: string | null | undefined) {
  return Boolean((v ?? "").trim());
}

function baseFilters(): DashboardFilters {
  return {
    from: "2025-01-01",
    to: "2027-12-31",
    empresas: [],
    empresaIds: [],
    setores: [],
    oficinas: [],
    criticidades: [],
    fabricantes: [],
    modelos: [],
    tipoManutencao: "Todos",
    somenteMedicos: false,
  };
}

function countBy(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntries(map: Map<string, number>, n = 12) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).slice(0, n);
}

function faltaLabel(p: PlanoSet) {
  const falta: string[] = [];
  if (!p.Preventiva) falta.push("Preventiva");
  if (!p["Calibração"]) falta.push("Calibração");
  if (!p.TSE) falta.push("TSE");
  return falta.join(", ") || "—";
}

async function main() {
  loadEnv();
  const filters = baseFilters();
  const eqParams = toUpstreamParams("equipamentos", filters, {
    apenasAtivos: "true",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "false",
  });
  const cronParams = toUpstreamParams("cronograma", filters);

  console.log("fetching equipamentos + cronograma (2025-01-01 → 2027-12-31)...");
  const [eqR, cronR] = await Promise.all([
    fetchPbi<EquipamentoItem[]>("equipamentos", eqParams),
    fetchPbi<CronogramaItem[]>("cronograma", cronParams),
  ]);

  if (!eqR.ok) {
    console.log("EQ_FAIL", eqR);
    process.exit(1);
  }
  if (!cronR.ok) {
    console.log("CRON_FAIL", cronR);
    process.exit(1);
  }

  const equipamentos = eqR.data;
  const cronograma = cronR.data;

  const sampleKeys = new Set<string>();
  for (const item of equipamentos.slice(0, 50)) {
    for (const k of Object.keys(item as object)) sampleKeys.add(k);
  }
  const tipoFilled = equipamentos.filter((e) => filled(tipoCadastro(e))).length;
  const critFilled = equipamentos.filter((e) => filled(e.Criticidade)).length;
  const anvisaFilled = equipamentos.filter((e) => filled(e.RegistroAnvisa)).length;

  function classifyRow(row: CronogramaItem): PlanoEcTipo | null {
    return classifyPlanoEc(row.TipoDeManutencao) || classifyPlanoEc(row.PlanoDeManutencao);
  }

  const planosByTagStrict = new Map<string, PlanoSet>();
  let linhasEcStrict = 0;
  let linhasSemTag = 0;
  const tiposRaw = new Map<string, number>();
  for (const row of cronograma) {
    countBy(tiposRaw, (row.TipoDeManutencao || "(vazio)").trim() || "(vazio)");
    const strict = classifyPlanoEc(row.TipoDeManutencao);
    const loose = classifyRow(row);
    if (strict) linhasEcStrict += 1;
    const tag = (row.Tag ?? "").trim();
    if (!tag) {
      if (loose) linhasSemTag += 1;
      continue;
    }
    if (strict) {
      const cur = planosByTagStrict.get(tag) ?? emptyPlanos();
      cur[strict] = true;
      planosByTagStrict.set(tag, cur);
    }
  }

  const { planosByTag: planosByTagLoose, linhasTipoVazioMasPlanoClassifica, linhasEcLoose } =
    buildPlanosByTagLoose(cronograma);

  const ativos = equipamentos;
  const comTag = ativos.filter((e) => filled(e.Tag));
  const semTag = ativos.length - comTag.length;
  const medicos = comTag.filter(isEquipamentoMedico);
  const naoMedicos = comTag.filter((e) => !isEquipamentoMedico(e));

  type GapRow = {
    tag: string;
    equipamento: string;
    setor: string;
    situacao: string;
    criticidade: string;
    medico: boolean;
    planos: PlanoSet;
    falta: string[];
  };

  function analyze(pool: EquipamentoItem[], index: Map<string, PlanoSet>) {
    const noPlano: GapRow[] = [];
    let comAlgum = 0;
    let semPrev = 0;
    let semCalib = 0;
    let semTse = 0;
    let comTodos = 0;
    let parcialSemPrev = 0;
    let parcialSemCalib = 0;
    let parcialSemTse = 0;

    for (const eq of pool) {
      const tag = eq.Tag.trim();
      const planos = index.get(tag) ?? emptyPlanos();
      const falta: string[] = [];
      if (!planos.Preventiva) {
        falta.push("Preventiva");
        semPrev += 1;
      }
      if (!planos["Calibração"]) {
        falta.push("Calibração");
        semCalib += 1;
      }
      if (!planos.TSE) {
        falta.push("TSE");
        semTse += 1;
      }
      const n = [planos.Preventiva, planos["Calibração"], planos.TSE].filter(Boolean).length;
      if (n === 0) {
        noPlano.push({
          tag,
          equipamento: eq.Equipamento?.trim() || "—",
          setor: eq.Setor?.trim() || "—",
          situacao: eq.Situacao?.trim() || "—",
          criticidade: eq.Criticidade?.trim() || "—",
          medico: isEquipamentoMedico(eq),
          planos,
          falta,
        });
      } else {
        comAlgum += 1;
        if (n === 3) comTodos += 1;
        if (!planos.Preventiva) parcialSemPrev += 1;
        if (!planos["Calibração"]) parcialSemCalib += 1;
        if (!planos.TSE) parcialSemTse += 1;
      }
    }
    return {
      noPlano,
      comAlgum,
      semPrev,
      semCalib,
      semTse,
      comTodos,
      parcialSemPrev,
      parcialSemCalib,
      parcialSemTse,
    };
  }

  const Astrict = analyze(comTag, planosByTagStrict);
  const Bstrict = analyze(medicos, planosByTagStrict);
  const Aloose = analyze(comTag, planosByTagLoose);
  const Bloose = analyze(medicos, planosByTagLoose);

  const requerKeys = [...sampleKeys].filter((k) =>
    /calib|requer|exige|plano|anvisa|familia|tipo|critic/i.test(k),
  );

  function summarizeGap(label: string, poolSize: number, res: ReturnType<typeof analyze>) {
    const sitGap = new Map<string, number>();
    const setorGap = new Map<string, number>();
    const nomeGap = new Map<string, number>();
    for (const row of res.noPlano) {
      countBy(sitGap, row.situacao || "(vazio)");
      countBy(setorGap, row.setor || "(vazio)");
      countBy(nomeGap, row.equipamento || "(vazio)");
    }
    return {
      label,
      parque: poolSize,
      noPlanoAlgumPrevCalibTse: res.comAlgum,
      foraDoPlano: res.noPlano.length,
      pctFora: ((res.noPlano.length / Math.max(poolSize, 1)) * 100).toFixed(1) + "%",
      quebraSemTipo_entreTodos: {
        semPreventiva: res.semPrev,
        semCalibracao: res.semCalib,
        semTSE: res.semTse,
      },
      quebraParcial_temAlgumMasFalta: {
        faltaPreventiva: res.parcialSemPrev,
        faltaCalibracao: res.parcialSemCalib,
        faltaTSE: res.parcialSemTse,
        comTodosTres: res.comTodos,
      },
      topSituacaoFora: topEntries(sitGap, 8),
      topSetorFora: topEntries(setorGap, 8),
      topNomeFora: topEntries(nomeGap, 10),
    };
  }

  const parkTags = new Set(comTag.map((e) => e.Tag.trim()));
  let cronTagsForaParque = 0;
  for (const tag of planosByTagLoose.keys()) {
    if (!parkTags.has(tag)) cronTagsForaParque += 1;
  }

  const examplesLoose = [...Bloose.noPlano]
    .sort(
      (a, b) =>
        critRank(a.criticidade) - critRank(b.criticidade) ||
        a.setor.localeCompare(b.setor, "pt-BR") ||
        a.tag.localeCompare(b.tag, "pt-BR"),
    )
    .slice(0, 15);

  const examplesPartial = medicos
    .map((eq) => {
      const planos = planosByTagLoose.get(eq.Tag.trim()) ?? emptyPlanos();
      const n = [planos.Preventiva, planos["Calibração"], planos.TSE].filter(Boolean).length;
      if (n === 0 || n === 3) return null;
      return {
        tag: eq.Tag.trim(),
        equipamento: eq.Equipamento?.trim() || "—",
        setor: eq.Setor?.trim() || "—",
        criticidade: eq.Criticidade?.trim() || "—",
        situacao: eq.Situacao?.trim() || "—",
        tem: [
          planos.Preventiva ? "Preventiva" : null,
          planos["Calibração"] ? "Calibração" : null,
          planos.TSE ? "TSE" : null,
        ]
          .filter(Boolean)
          .join(", "),
        falta: faltaLabel(planos),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        critRank(a!.criticidade) - critRank(b!.criticidade) ||
        a!.tag.localeCompare(b!.tag, "pt-BR"),
    )
    .slice(0, 8);

  const altaTotal = medicos.filter((e) => critRank(e.Criticidade || "") === 0).length;
  const altaForaLoose = medicos.filter((e) => {
    if (critRank(e.Criticidade || "") !== 0) return false;
    const p = planosByTagLoose.get(e.Tag.trim());
    return !p || !(p.Preventiva || p["Calibração"] || p.TSE);
  }).length;

  const out = {
    janela: { from: filters.from, to: filters.to },
    metodo: {
      strict: "classifyPlanoEc(TipoDeManutencao) — igual aos helpers do app",
      loose:
        "classifyPlanoEc(TipoDeManutencao) || classifyPlanoEc(PlanoDeManutencao) — recupera linhas com Tipo vazio",
      linhasTipoVazioMasPlanoClassifica,
      linhasEcStrict,
      linhasEcLoose,
    },
    volumes: {
      equipamentosAtivos: ativos.length,
      comTag: comTag.length,
      semTag,
      medicosComTag: medicos.length,
      naoMedicosComTag: naoMedicos.length,
      linhasCronograma: cronograma.length,
      linhasEcSemTag: linhasSemTag,
      tagsComPlanoStrict: planosByTagStrict.size,
      tagsComPlanoLoose: planosByTagLoose.size,
      tagsCronogramaForaDoParqueAtivo: cronTagsForaParque,
    },
    camadaA_bruto_strict: summarizeGap("A strict", comTag.length, Astrict),
    camadaA_bruto_loose: summarizeGap("A loose", comTag.length, Aloose),
    camadaB_medico_strict: summarizeGap("B strict", medicos.length, Bstrict),
    camadaB_medico_loose: summarizeGap("B loose (recomendado para operação)", medicos.length, Bloose),
    altaCriticidade_medico_loose: { total: altaTotal, foraDoPlano: altaForaLoose },
    camadaC_campos: {
      keysRelacionadas: requerKeys,
      tipoCadastroPreenchido: tipoFilled,
      criticidadePreenchida: critFilled,
      registroAnvisaPreenchido: anvisaFilled,
      nota:
        "Não há flag 'requer calibração/preventiva/TSE' no DTO. Tipo/Família: 0 preenchidos. Criticidade e ANVISA existem mas não definem obrigatoriedade de plano.",
    },
    topTiposCronograma: topEntries(tiposRaw, 10),
    exemplosMedicosFora_loose: examplesLoose.map((e) => ({
      tag: e.tag,
      equipamento: e.equipamento,
      setor: e.setor,
      criticidade: e.criticidade,
      situacao: e.situacao,
      falta: faltaLabel(e.planos),
    })),
    exemplosMedicosParcial_loose: examplesPartial,
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
