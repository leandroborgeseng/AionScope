"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shell/page-header";
import { SectionError } from "@/components/pending/pending-banner";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  useCreateEquipamentoTerceiro,
  useDeleteEquipamentoTerceiro,
  useEquipamentosTerceiros,
  useUpdateEquipamentoTerceiro,
} from "@/hooks/use-cadastros";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import {
  distinctTerceiros,
  isSituacaoTerceiro,
  mergeTerceirosLista,
  type TerceiroListRow,
} from "@/lib/cadastros/terceiros";
import type { EquipamentoTerceiroInput } from "@/lib/cadastros/types";
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

const EMPTY_FORM: EquipamentoTerceiroInput = {
  tag: "",
  descricao: "",
  medicoResponsavel: "",
  setor: "",
  observacao: "",
  ativo: true,
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
  const locaisQ = useEquipamentosTerceiros();
  const create = useCreateEquipamentoTerceiro();
  const update = useUpdateEquipamentoTerceiro();
  const del = useDeleteEquipamentoTerceiro();

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
  const [form, setForm] = useState<EquipamentoTerceiroInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const apiItems = dataOf(eqQ.data) ?? [];
  const locais = locaisQ.data ?? [];
  const rows = useMemo(() => mergeTerceirosLista(apiItems, locais), [apiItems, locais]);
  const terceirosOpts = useMemo(() => distinctTerceiros(rows), [rows]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    const tFiltro = terceiroFiltro.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => {
      if (tFiltro && row.terceiro.toLocaleLowerCase("pt-BR") !== tFiltro) return false;
      if (!q) return true;
      const hay = `${row.tag} ${row.descricao} ${row.setor} ${row.terceiro} ${row.fornecedor} ${row.medicoResponsavel}`.toLocaleLowerCase(
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
    const id = selected.api?.Id;
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

  const nTerceiroApi = useMemo(
    () => apiItems.filter((i) => isSituacaoTerceiro(i.Situacao)).length,
    [apiItems],
  );

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
      id: "origem",
      header: "Origem",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {!row.original.noApi ? <Badge tone="info">API</Badge> : <Badge tone="warn">Só local</Badge>}
          {!row.original.noLocal ? <Badge tone="ok">Local</Badge> : null}
        </div>
      ),
    },
  ];

  function loadEdit(row: TerceiroListRow) {
    if (!row.local) {
      setEditingId(null);
      setForm({
        tag: row.tag,
        descricao: row.descricao === "—" ? "" : row.descricao,
        medicoResponsavel: "",
        setor: row.setor === "—" ? "" : row.setor,
        observacao: "",
        ativo: true,
      });
      setMsg(null);
      return;
    }
    setEditingId(row.local.id);
    setForm({
      tag: row.local.tag,
      descricao: row.local.descricao ?? "",
      medicoResponsavel: row.local.medicoResponsavel ?? "",
      setor: row.local.setor ?? "",
      observacao: row.local.observacao ?? "",
      ativo: row.local.ativo,
    });
    setMsg(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, ...form });
        setMsg("Acompanhamento local atualizado.");
      } else {
        await create.mutateAsync(form);
        setMsg("Acompanhamento local criado.");
      }
      resetForm();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  const eqError = errorOf(eqQ.data);
  const loading = eqQ.isLoading || locaisQ.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipamentos de terceiros"
        description="Situação começa com TERCEIRO na API (ex.: TERCEIRO - SODEXO), com ValorDeSubstituicao via incluirCustoSubstituicao=true. Filtro de terceiro = sufixo da Situação (ou Fornecedor / médico local). Lançamento local em SQLite."
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
      {locaisQ.error ? (
        <SectionError
          message={`Cadastro local: ${locaisQ.error instanceof Error ? locaisQ.error.message : "Erro desconhecido"}`}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>TERCEIRO na API</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{eqQ.isLoading ? "…" : nTerceiroApi}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Acompanhamento local</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{locaisQ.isLoading ? "…" : locais.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Lista mesclada (filtro atual)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{filtered.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar acompanhamento local" : "Lançar acompanhamento local"}</CardTitle>
          <CardDescription>
            Registra Tag + médico/responsável no SQLite. Ao abrir o detalhe, cruza com a API por Tag (anexos e
            preventivas).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Tag *</span>
              <Input
                required
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder="Ex.: 0101120391"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Médico / responsável</span>
              <Input
                value={form.medicoResponsavel ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, medicoResponsavel: e.target.value }))}
                placeholder="Nome do médico ou responsável"
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Descrição</span>
              <Input
                value={form.descricao ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Setor</span>
              <Input
                value={form.setor ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo !== false}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              />
              Ativo no acompanhamento
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Observação</span>
              <Input
                value={form.observacao ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editingId ? "Salvar" : "Lançar"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar edição
                </Button>
              ) : null}
              {msg ? <span className="text-sm text-aion-ink/70">{msg}</span> : null}
            </div>
          </form>
        </CardContent>
      </Card>

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
            Opções = sufixo de Situação após &quot;TERCEIRO -&quot; (API), senão Fornecedor ou médico local.
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
              {!selected.noApi ? <Badge tone="info">Na API</Badge> : <Badge tone="warn">Sem match na API</Badge>}
              {!selected.noLocal ? (
                <Badge tone="ok">No acompanhamento local</Badge>
              ) : (
                <Badge>Sem lançamento local</Badge>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => loadEdit(selected)}>
                {selected.local ? "Editar local" : "Lançar no local"}
              </Button>
              {selected.local ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!selected.local) return;
                    if (!confirm(`Remover acompanhamento local da Tag ${selected.tag}?`)) return;
                    try {
                      await del.mutateAsync(selected.local.id);
                      setMsg("Acompanhamento local removido.");
                    } catch (err) {
                      setMsg(err instanceof Error ? err.message : "Erro ao excluir.");
                    }
                  }}
                >
                  Remover local
                </Button>
              ) : null}
            </div>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-aion-ink">Dados gerais</h3>
              {selected.api ? (
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
                  <Field
                    label="Terceiro (da Situação)"
                    value={selected.terceiro || "—"}
                  />
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
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tag" value={selected.tag} />
                  <Field label="Descrição (local)" value={selected.local?.descricao} />
                  <Field label="Médico / responsável" value={selected.local?.medicoResponsavel} />
                  <Field label="Setor (local)" value={selected.local?.setor} />
                  <Field label="Observação" value={selected.local?.observacao} />
                  <Field
                    label="Valor de substituição"
                    value="Indisponível (Tag não encontrada na API TERCEIRO)"
                  />
                </dl>
              )}
              {selected.local && selected.api ? (
                <p className="mt-3 text-sm text-aion-ink/65">
                  Local: médico/responsável <strong>{selected.local.medicoResponsavel || "—"}</strong>
                  {selected.local.observacao ? ` · ${selected.local.observacao}` : ""}
                </p>
              ) : null}
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
