/**
 * Cálculo do custo/parque NO SERVIDOR para a Sala/TV sem login (D1).
 * Lê GlobalThings (fetchPbi, com cache) + cadastro local e usa a MESMA montagem do navegador.
 * A rota pública só expõe o resumo sem R$ (resumoCustoParquePublico).
 */
import { readContratos, readParqueMeta } from "@/lib/cadastros/store";
import { lerParqueMensal } from "@/lib/cadastros/parque-historico";
import { fetchPbi } from "@/lib/pbi/client";
import { nowInSaoPaulo, startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams } from "@/lib/pbi/filters";
import { buildMedicalIndex } from "@/lib/pbi/medical";
import { parqueRegraDe } from "@/lib/pbi/parque-frescor";
import { queryErrorMessage } from "@/lib/pbi/query-error";
import type { EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, currentCalendarYearRange } from "@/lib/pbi/volume-ec";
import { montarCustoParque } from "@/lib/indicadores/custo-parque-montar";

export async function calcularCustoParqueServidor() {
  const hoje = nowInSaoPaulo();
  const range = currentCalendarYearRange(hoje);
  const base = { ...EMPTY_FILTERS, from: startOfMonthISO(), to: todayISO(), tipoManutencao: "Todos" as const, somenteMedicos: false };
  const [osR, medR, eqR] = await Promise.all([
    fetchPbi<OsAnaliticoItem[]>(
      "os-analitico",
      toUpstreamParams("os-analitico", { ...EMPTY_FILTERS, from: range.fromISO, to: range.toISO, tipoManutencao: VOLUME_EC_TIPO_API, somenteMedicos: false }, { periodo: VOLUME_EC_PERIODO_API, qtdPorPagina: "100000" }),
    ),
    fetchPbi<EquipamentoItem[]>("equipamentos", toUpstreamParams("equipamentos", base, { apenasAtivos: "false", incluirComponentes: "false", incluirCustoSubstituicao: "false" })),
    fetchPbi<EquipamentoItem[]>("equipamentos", toUpstreamParams("equipamentos", base, { apenasAtivos: "true", incluirComponentes: "false", incluirCustoSubstituicao: "true" })),
  ]);
  const medical = buildMedicalIndex(medR.ok ? medR.data : []);
  let contratos: ReturnType<typeof readContratos> = [];
  let contratosErro = false;
  try {
    contratos = readContratos();
  } catch {
    contratosErro = true;
  }
  const meta = readParqueMeta();
  const erroLeitura = !osR.ok || !medR.ok || !eqR.ok || contratosErro;
  const r = montarCustoParque({
    range,
    hoje,
    os: osR.ok ? osR.data : [],
    osErro: queryErrorMessage(osR, null, "OS da GlobalThings indisponíveis"),
    medicalTags: medical.tags,
    medicalIds: medical.ids,
    medicalErro: queryErrorMessage(medR, null, "cadastro de equipamentos indisponível"),
    equipamentosAtivos: eqR.ok ? eqR.data : [],
    parqueGravado: meta.valorApi ?? null,
    regra: parqueRegraDe(process.env.PARQUE_REGRA),
    mensal: lerParqueMensal(),
    contratos,
    contratosErro,
  });
  return { ...r, erroLeitura };
}
