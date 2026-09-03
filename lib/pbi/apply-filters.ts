import { matchesTextFilters, matchesTipoManutencao, type DashboardFilters } from "./filters";
import { isTipoManutencaoMedica, linkedToMedicalPark } from "./medical";
import type {
  AnexoEquipamentoItem,
  AnexoOsItem,
  CronogramaItem,
  DisponibilidadeItem,
  EquipamentoItem,
  MonitorAtendimentoItem,
  MonitorReacaoItem,
  OsAnaliticoItem,
  OsResumidaItem,
  TmefItem,
} from "./types";

function matchesMedical(
  filters: DashboardFilters,
  opts: { tag?: string; id?: number; tipoManutencao?: string; requireLink?: boolean },
) {
  if (!filters.somenteMedicos) return true;
  if (!filters.medicalTags || !filters.medicalIds) return true;

  const linked = linkedToMedicalPark(opts.tag, opts.id, filters.medicalTags, filters.medicalIds);
  if (linked) return true;
  if (opts.tag) return false;
  if (opts.requireLink) return false;
  if (opts.tipoManutencao != null) return isTipoManutencaoMedica(opts.tipoManutencao);
  return false;
}

export function filterCronograma(items: CronogramaItem[], filters: DashboardFilters) {
  return items.filter(
    (item) =>
      matchesTipoManutencao(item.TipoDeManutencao, filters.tipoManutencao) &&
      matchesMedical(filters, { tag: item.Tag, tipoManutencao: item.TipoDeManutencao }) &&
      matchesTextFilters(item, filters, {
        empresas: "Empresa",
        setores: "Setor",
        fabricantes: "Fabricante",
        modelos: "Modelo",
      }),
  );
}

export function filterOs<T extends OsAnaliticoItem | OsResumidaItem>(items: T[], filters: DashboardFilters) {
  return items.filter(
    (item) =>
      matchesTipoManutencao(item.TipoDeManutencao, filters.tipoManutencao) &&
      matchesMedical(filters, {
        tag: "Tag" in item ? String(item.Tag ?? "") : "",
        tipoManutencao: item.TipoDeManutencao,
      }) &&
      matchesTextFilters(item, filters, {
        empresas: "Empresa",
        setores: "Setor",
        oficinas: "Oficina",
        fabricantes: "Fabricante",
        modelos: "Modelo",
      }),
  );
}

export function filterEquipamentos(items: EquipamentoItem[], filters: DashboardFilters) {
  return items.filter(
    (item) =>
      matchesMedical(filters, { tag: item.Tag, id: item.Id, requireLink: true }) &&
      matchesTextFilters(item, filters, {
        empresas: ["RazaoSocial", "Cliente"],
        setores: "Setor",
        criticidades: "Criticidade",
        fabricantes: "Fabricante",
        modelos: "Modelo",
      }),
  );
}

export function filterTmef(items: TmefItem[], filters: DashboardFilters) {
  return items.filter(
    (item) =>
      matchesMedical(filters, { tag: item.Tag, requireLink: true }) &&
      matchesTextFilters(item, filters, {
        empresas: "Empresa",
        setores: "Setor",
        fabricantes: "Fabricante",
        modelos: "Modelo",
      }),
  );
}

export function filterDisponibilidade(items: DisponibilidadeItem[], filters: DashboardFilters) {
  return items.filter((item) => {
    const empresaOk =
      !filters.empresas.length ||
      filters.empresas.some((nome) =>
        `${item.CaminhoSetor} ${item.CentrosDeCusto}`.toLocaleLowerCase("pt-BR").includes(nome.toLocaleLowerCase("pt-BR")),
      );
    return (
      empresaOk &&
      matchesMedical(filters, { tag: item.Tag, id: item.EquipamentoId, requireLink: true }) &&
      matchesTextFilters(item, filters, {
        setores: "SetorDescricao",
        criticidades: "Criticidade",
        fabricantes: "Fabricante",
        modelos: "ModeloDescricao",
      })
    );
  });
}

export function filterMonitorReacao(items: MonitorReacaoItem[], filters: DashboardFilters) {
  return items.filter(
    (item) =>
      matchesTipoManutencao(item.TipoManutencao, filters.tipoManutencao) &&
      matchesMedical(filters, { tag: item.Tag, tipoManutencao: item.TipoManutencao }) &&
      matchesTextFilters(item, filters, { empresas: "Empresa", setores: "Setor" }),
  );
}

export function filterMonitorAtendimento(items: MonitorAtendimentoItem[], filters: DashboardFilters) {
  return items.filter(
    (item) =>
      matchesTipoManutencao(item.TipoManutencao, filters.tipoManutencao) &&
      matchesMedical(filters, { tag: item.Tag, tipoManutencao: item.TipoManutencao }) &&
      matchesTextFilters(item, filters, { empresas: "Empresa", setores: "Setor" }),
  );
}

export function filterAnexosEquip(items: AnexoEquipamentoItem[], filters: DashboardFilters, tags?: Set<string>) {
  return items.filter((item) => {
    if (tags && !tags.has(item.Tag)) return false;
    return matchesMedical(filters, { tag: item.Tag, id: item.EquipamentoId, requireLink: true });
  });
}

export function filterAnexosOs(items: AnexoOsItem[], _filters: DashboardFilters) {
  return items;
}
