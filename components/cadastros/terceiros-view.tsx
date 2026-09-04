"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shell/page-header";
import { SectionError } from "@/components/pending/pending-banner";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import {
  buildTerceirosLista,
  distinctTerceiros,
  resumirValorSubstituicaoPorTerceiro,
  type TerceiroListRow,
} from "@/lib/cadastros/terceiros";
import { formatDateBR, formatDateTimeBR, parseBrNumber, startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, isPreventiva } from "@/lib/pbi/filters";
import { formatBRL } from "@/lib/pbi/indicators";
import type {
  AnexoEquipamentoItem,
  AnexoOsItem,
  EquipamentoItem,
  OsAnaliticoItem,
} from "@/lib/pbi/types";

const EQ_FILTERS = {
  ...EMPTY_FILTERS,
  from: startOfMonthISO(),
  to: todayISO(),
  tipoManutencao: "Todos" as const,
  somenteMedicos: false,
};

function formatValorSubstituicao(raw: string | null | undefined) {
  const n = parseBrNumber(raw);
  if (n == null || n <= 0) return "—";
  return formatBRL(n);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-aion-ink/50 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-aion-ink">{value || "—"}</dd>
    </div>
  );
}

function AnexoList({
  items,
  emptyLabel,
}: {
  items: Array<{
    key: string;
    nome: string;
    tipo: string;
    data: string;
    link?: string;
  }>;
  emptyLabel: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-aion-ink/55">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-y divide-aion-line rounded-lg border border-aion-line">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-aion-blue hover:underline"
              >
                {item.nome}
              </a>
            ) : (
              <span className="text-sm font-medium text-aion-ink">{item.nome}</span>
            )}
            <p className="text-xs text-aion-ink/55">
              {item.tipo || "Sem tipo"} · {item.data || "—"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TerceirosCadastroView() {
  const eqQ = usePbiQuery<EquipamentoItem[]>("equipamentos", EQ_FILTERS, {
    apenasAtivos: "true",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "true",
  });
  const axEqQ = usePbiQuery<AnexoEquipamentoItem[]>("anexos-equipamento", EQ_FILTERS);
  const axOsQ = usePbiQuery<AnexoOsItem[]>("anexos-os", EQ_FILTERS);
  const osYear = useOsAnaliticoRollingYear();

  const [busca, setBusca] = useState("");
  const [terceiroFiltro, setTerceiroFiltro] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const apiItems = dataOf(eqQ.data) ?? [];
  const rows = useMemo(() => buildTerceirosLista(apiItems), [apiItems]);
  const terceirosOpts = useMemo(() => distinctTerceiros(rows), [rows]);
  const totaisValor = useMemo(() => resumirValorSubstituicaoPorTerceiro(rows), [rows]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    const tFiltro = terceiroFiltro.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => {
      if (tFiltro && row.terceiro.toLocaleLowerCase("pt-BR") !== tFiltro) return false;
      if (!q) return true;
      const hay = `${row.tag} ${row.descricao} ${row.setor} ${row.terceiro} ${row.fornecedor}`.toLocaleLowerCase(
        "pt-BR",
      );
      return hay.includes(q);
    });
  }, [rows, busca, terceiroFiltro]);

  const selected = useMemo(
    () => filtered.find((r) => r.key === selectedKey) ?? rows.find((r) => r.key === selectedKey) ?? null,
    [filtered, rows, selectedKey],
  );

  const anexosEq = useMemo(() => {
    const all = dataOf(axEqQ.data) ?? [];
    if (!selected) return [];
    const tag = selected.tag.trim().toLocaleUpperCase("pt-BR");
    const id = selected.api.Id;
    return all.filter(
      (a) =>
        (a.Tag && a.Tag.trim().toLocaleUpperCase("pt-BR") === tag) ||
        (id != null && a.EquipamentoId === id),
    );
  }, [axEqQ.data, selected]);

  const preventivas = useMemo(() => {
    if (!selected) return [] as OsAnaliticoItem[];
    const tag = selected.tag.trim().toLocaleUpperCase("pt-BR");
    return osYear.raw.filter(
      (os) =>
        os.Tag?.trim().toLocaleUpperCase("pt-BR") === tag && isPreventiva(os.TipoDeManutencao),
    );
  }, [osYear.raw, selected]);

  const anexosOsMap = useMemo(() => {
    const all = dataOf(axOsQ.data) ?? [];
    const byCode = new Map<string, AnexoOsItem[]>();
    for (const a of all) {
      const code = (a.CodigoOS || String(a.OSId)).trim();
      if (!code) continue;
      const list = byCode.get(code) ?? [];
      list.push(a);
      byCode.set(code, list);
    }
    return byCode;
  }, [axOsQ.data]);

  const columns: ColumnDef<TerceiroListRow, unknown>[] = [
    {
      accessorKey: "tag",
      header: "Tag",
      cell: ({ row }) => (
        <button
          type="button"
          className="font-medium text-aion-blue hover:underline"
          onClick={() => setSelectedKey(row.original.key)}
        >
          {row.original.tag}
        </button>
      ),
    },
    { accessorKey: "descricao", header: "Descrição" },
    {
      accessorKey: "terceiro",
      header: "Terceiro",
      cell: ({ row }) => row.original.terceiro || "—",
    },
    { accessorKey: "setor", header: "Setor" },
    {
      id: "valorSubstituicao",
      header: "Valor substituição",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatValorSubstituicao(row.original.valorSubstituicao)}</span>
      ),
    },
    {
      accessorKey: "situacao",
      header: "Situação",
      cell: ({ row }) => row.original.situacao || "—",
    },
  ];

  const eqError = errorOf(eqQ.data);
  const loading = eqQ.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipamentos de terceiros"
        description="Fonte: API GlobalThings — somente leitura. Situação começa com TERCEIRO (ex.: TERCEIRO - SODEXO), com ValorDeSubstituicao via incluirCustoSubstituicao=true. Filtro de terceiro = sufixo da Situação (ou Fornecedor)."
        actions={
          <Link
            href="/cadastros"
            className="inline-flex h-8 items-center rounded-lg border border-aion-line bg-white px-2.5 text-xs font-medium text-aion-ink hover:border-aion-blue/40 hover:bg-aion-mist"
          >
            Voltar
          </Link>
        }
      />

      {eqError ? <SectionError message={`Equipamentos: ${eqError.message}`} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>TERCEIRO na API</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{eqQ.isLoading ? "…" : rows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Lista (filtro atual)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{filtered.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Total substituição</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {eqQ.isLoading ? "…" : formatBRL(totaisValor.somaSubstituicaoTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {!eqQ.isLoading && totaisValor.porTerceiro.length > 0 ? (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle>Valor de substituição por terceiro</CardTitle>
            <CardDescription>
              Soma de ValorDeSubstituicao agrupada pelo sufixo de Situação (ex.: SODEXO) — mesmo critério do filtro.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-2">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-aion-line text-xs tracking-wide text-aion-ink/50 uppercase">
                  <th className="py-2 pr-3 font-medium">Terceiro</th>
                  <th className="py-2 pr-3 text-right font-medium">Qtd</th>
                  <th className="py-2 text-right font-medium">Soma substituição</th>
                </tr>
              </thead>
              <tbody>
                {totaisValor.porTerceiro.map((g) => (
                  <tr key={g.terceiro} className="border-b border-aion-line/70 last:border-0">
                    <td className="py-2 pr-3 text-aion-ink">
                      <button
                        type="button"
                        className="text-left font-medium text-aion-blue hover:underline"
                        onClick={() => setTerceiroFiltro(g.terceiro === "(sem identificação)" ? "" : g.terceiro)}
                      >
                        {g.terceiro}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-aion-ink">{g.quantidade}</td>
                    <td className="py-2 text-right tabular-nums text-aion-ink">
                      {g.somaSubstituicao > 0 ? formatBRL(g.somaSubstituicao) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-aion-line">
                  <td className="pt-2.5 pr-3 font-semibold text-aion-ink">Total geral</td>
                  <td className="pt-2.5 pr-3 text-right font-semibold tabular-nums text-aion-ink">
                    {totaisValor.quantidadeTotal}
                  </td>
                  <td className="pt-2.5 text-right font-semibold tabular-nums text-aion-ink">
                    {formatBRL(totaisValor.somaSubstituicaoTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-sm text-aion-ink/60">Fonte: API GlobalThings — somente leitura</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid min-w-0 flex-1 gap-1 text-sm">
          <span className="font-medium">Busca</span>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Tag, descrição, setor, terceiro…"
          />
        </label>
        <label className="grid w-full gap-1 text-sm sm:w-72">
          <span className="font-medium">Filtrar por terceiro</span>
          <select
            className="h-9 rounded-lg border border-aion-line bg-white px-3 text-sm text-aion-ink"
            value={terceiroFiltro}
            onChange={(e) => setTerceiroFiltro(e.target.value)}
          >
            <option value="">Todos ({terceirosOpts.length} distintos)</option>
            {terceirosOpts.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-aion-ink/50">
            Opções = sufixo de Situação após &quot;TERCEIRO -&quot; (API), senão Fornecedor.
          </span>
        </label>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => setSelectedKey(row.key)}
        />
      )}

      <Sheet
        open={!!selected}
        title={selected ? `${selected.tag} — ${selected.descricao}` : ""}
        subtitle={
          selected
            ? `Terceiro: ${selected.terceiro || "—"} · Valor substituição: ${formatValorSubstituicao(selected.valorSubstituicao)}`
            : undefined
        }
        onClose={() => setSelectedKey(null)}
      >
        {selected ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">API GlobalThings</Badge>
              <Badge>Somente leitura</Badge>
            </div>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-aion-ink">Dados gerais</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Field label="Tag" value={selected.api.Tag} />
                <Field label="Descrição" value={selected.api.Equipamento} />
                <Field label="Modelo" value={selected.api.Modelo} />
                <Field label="Fabricante" value={selected.api.Fabricante} />
                <Field label="Patrimônio" value={selected.api.Patrimonio} />
                <Field label="Nº série" value={selected.api.NSerie} />
                <Field label="Setor" value={selected.api.Setor} />
                <Field label="Grupo de setores" value={selected.api.GrupoDeSetores} />
                <Field label="Fornecedor" value={selected.api.Fornecedor || "—"} />
                <Field label="Terceiro (da Situação)" value={selected.terceiro || "—"} />
                <Field label="Situação" value={selected.api.Situacao} />
                <Field label="Status" value={selected.api.Status} />
                <Field label="Criticidade" value={selected.api.Criticidade} />
                <Field label="Registro ANVISA" value={selected.api.RegistroAnvisa} />
                <Field
                  label="Validade ANVISA"
                  value={formatDateBR(selected.api.ValidadeDoRegistroAnvisa)}
                />
                <Field
                  label="Valor de substituição"
                  value={
                    <span className="tabular-nums font-medium">
                      {formatValorSubstituicao(selected.api.ValorDeSubstituicao)}
                    </span>
                  }
                />
                <Field
                  label="Valor de aquisição"
                  value={
                    <span className="tabular-nums">
                      {formatValorSubstituicao(selected.api.ValorDeAquisicao)}
                    </span>
                  }
                />
                <Field label="Nota fiscal" value={selected.api.NotaFiscal} />
                <Field label="Data aquisição" value={formatDateBR(selected.api.DataDeAquisicao)} />
                <Field
                  label="Data instalação"
                  value={formatDateBR(selected.api["DataDeInstalação"])}
                />
                <Field label="Data cadastro" value={formatDateBR(selected.api.DataDeCadastro)} />
                <Field label="Centro de custo" value={selected.api.CentroDeCusto} />
                <Field label="Cliente" value={selected.api.Cliente} />
                <Field label="Observação API" value={selected.api.Observacao} />
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-aion-ink">
                Documentação / anexos do equipamento
              </h3>
              <p className="mb-2 text-xs text-aion-ink/55">
                {anexosEq.length
                  ? `${anexosEq.length} anexo(s) no GlobalThings`
                  : "Checklist: sem anexos"}
              </p>
              <AnexoList
                emptyLabel="Sem anexos no GlobalThings"
                items={anexosEq.map((a, i) => ({
                  key: `${a.EquipamentoId}-${a.Anexo}-${i}`,
                  nome: a.Anexo || "Anexo",
                  tipo: a.TipoAnexo || "",
                  data: formatDateTimeBR(a.DataHoraInclusao),
                  link: a.LinkAnexo || undefined,
                }))}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-aion-ink">
                Manutenção preventiva (OS · 12 meses)
              </h3>
              {osYear.loading ? (
                <p className="text-sm text-aion-ink/55">Carregando OS…</p>
              ) : osYear.error ? (
                <p className="text-sm text-rose-700">{osYear.error}</p>
              ) : !preventivas.length ? (
                <p className="text-sm text-aion-ink/55">Nenhuma preventiva encontrada</p>
              ) : (
                <ul className="space-y-3">
                  {preventivas.map((os) => {
                    const code = (os.OS || String(os.CodigoSerialOS)).trim();
                    const anexos = anexosOsMap.get(code) ?? anexosOsMap.get(String(os.CodigoSerialOS)) ?? [];
                    return (
                      <li
                        key={`${os.CodigoSerialOS}-${os.OS}`}
                        className="rounded-lg border border-aion-line p-3"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-aion-ink">
                            OS {os.OS || os.CodigoSerialOS} · {os.TipoDeManutencao}
                          </p>
                          <Badge>{os.SituacaoDaOS || "—"}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-aion-ink/55">
                          Abertura {formatDateBR(os.Abertura)} · Fechamento {formatDateBR(os.Fechamento)} ·{" "}
                          {os.PlanoDeManutencao || "Sem plano"}
                        </p>
                        <div className="mt-2">
                          <p className="mb-1 text-xs font-medium text-aion-ink/60">Anexos / laudos da OS</p>
                          <AnexoList
                            emptyLabel="Sem anexos da OS no GlobalThings"
                            items={anexos.map((a, i) => ({
                              key: `${a.OSId}-${a.Anexo}-${i}`,
                              nome: a.Anexo || "Anexo",
                              tipo: a.TipoAnexo || "",
                              data: formatDateTimeBR(a.DataHoraInclusao),
                              link: a.LinkAnexo || undefined,
                            }))}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {axOsQ.data && !axOsQ.data.ok ? (
                <p className="mt-2 text-xs text-amber-800">
                  Anexos de OS indisponíveis: {errorOf(axOsQ.data)?.message ?? "erro na API"}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
