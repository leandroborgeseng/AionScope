"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { formatDateBR, nowInSaoPaulo } from "@/lib/pbi/dates";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API } from "@/lib/pbi/volume-ec";
import { buildFichaVida } from "@/lib/etiquetas/ficha-vida";
import { PLANOS_ETIQUETA } from "@/lib/etiquetas/tipos";

export default function FichaVidaPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawTag } = use(params);
  const tag = decodeURIComponent(rawTag);

  const eqFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      from: "",
      to: "",
      tipoManutencao: "Todos" as const,
      somenteMedicos: false,
    }),
    [],
  );
  const osFilters = eqFilters;

  const eqQ = usePbiQuery<EquipamentoItem[]>("equipamentos", eqFilters, {
    apenasAtivos: "false",
    qtdPorPagina: "100000",
  });
  const osQ = usePbiQuery<OsAnaliticoItem[]>("os-analitico", osFilters, {
    periodo: VOLUME_EC_PERIODO_API,
    qtdPorPagina: "100000",
  });
  const cronoQ = usePbiQuery<CronogramaItem[]>("cronograma", eqFilters, {
    qtdPorPagina: "100000",
  });

  const loading = eqQ.isLoading || osQ.isLoading || cronoQ.isLoading;
  const error =
    errorOf(eqQ.data)?.message || errorOf(osQ.data)?.message || errorOf(cronoQ.data)?.message;

  const ficha = useMemo(() => {
    const equipamentos = dataOf(eqQ.data) ?? [];
    const os = dataOf(osQ.data) ?? [];
    const crono = dataOf(cronoQ.data) ?? [];
    return buildFichaVida(tag, equipamentos, os, crono);
  }, [tag, eqQ.data, osQ.data, cronoQ.data]);

  const ano = nowInSaoPaulo().getFullYear();

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Ficha vida · ${ficha.tag}`}
        description="Registro do equipamento (Tag) para QR das etiquetas de plano. Sem dados pessoais (LGPD)."
        actions={
          <Link
            href="/etiquetas"
            className="rounded-lg border border-aion-line bg-white px-3 py-2 text-sm text-aion-blue hover:bg-aion-mist"
          >
            ← Etiquetas
          </Link>
        }
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ficha.nome}</CardTitle>
              <p className="text-xs text-aion-muted">
                Tag <span className="font-mono font-semibold text-aion-ink">{ficha.tag}</span>
              </p>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div>
                  <dt className="text-xs text-aion-muted">Modelo</dt>
                  <dd>{ficha.modelo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-aion-muted">Fabricante</dt>
                  <dd>{ficha.fabricante}</dd>
                </div>
                <div>
                  <dt className="text-xs text-aion-muted">Setor</dt>
                  <dd>{ficha.setor}</dd>
                </div>
                <div>
                  <dt className="text-xs text-aion-muted">Centro de custo</dt>
                  <dd>{ficha.centroDeCusto}</dd>
                </div>
                <div>
                  <dt className="text-xs text-aion-muted">Criticidade</dt>
                  <dd>{ficha.criticidade}</dd>
                </div>
                <div>
                  <dt className="text-xs text-aion-muted">Status</dt>
                  <dd>{ficha.status}</dd>
                </div>
                <div>
                  <dt className="text-xs text-aion-muted">Patrimônio</dt>
                  <dd>{ficha.patrimonio}</dd>
                </div>
                <div>
                  <dt className="text-xs text-aion-muted">Nº de série</dt>
                  <dd>{ficha.nSerie}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ciclo / cronograma</CardTitle>
            </CardHeader>
            <CardContent>
              {ficha.cronograma.length === 0 ? (
                <p className="text-sm text-aion-muted">Sem linhas de cronograma para esta Tag.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-aion-muted">
                      <tr>
                        <th className="py-2 pr-3">Plano</th>
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Última</th>
                        <th className="py-2 pr-3">Próxima</th>
                        <th className="py-2">Periodicidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ficha.cronograma.map((c, i) => (
                        <tr key={`${c.plano}-${i}`} className="border-t border-aion-line/70">
                          <td className="py-2 pr-3">{c.plano || "—"}</td>
                          <td className="py-2 pr-3">{c.tipo || "—"}</td>
                          <td className="py-2 pr-3">{formatDateBR(c.ultima)}</td>
                          <td className="py-2 pr-3">{formatDateBR(c.proxima)}</td>
                          <td className="py-2">{c.periodicidade || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OS recentes ({ano - 1}–{ano})</CardTitle>
            </CardHeader>
            <CardContent>
              {ficha.osRecentes.length === 0 ? (
                <p className="text-sm text-aion-muted">Nenhuma OS encontrada para esta Tag.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-aion-muted">
                      <tr>
                        <th className="py-2 pr-3">OS</th>
                        <th className="py-2 pr-3">Oficina</th>
                        <th className="py-2 pr-3">Plano</th>
                        <th className="py-2 pr-3">Situação</th>
                        <th className="py-2 pr-3">Abertura</th>
                        <th className="py-2">Prazo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ficha.osRecentes.map((row) => {
                        const chip = PLANOS_ETIQUETA.find((p) => p.id === row.plano);
                        return (
                          <tr key={`${row.os}-${row.abertura}`} className="border-t border-aion-line/70">
                            <td className="py-2 pr-3 font-mono text-xs">{row.os}</td>
                            <td className="py-2 pr-3">{row.oficina}</td>
                            <td className="py-2 pr-3">
                              {chip ? <Badge tone="info">{chip.chip}</Badge> : "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {row.aberta ? <Badge tone="warn">Aberta</Badge> : row.situacao || "—"}
                            </td>
                            <td className="py-2 pr-3">{formatDateBR(row.abertura)}</td>
                            <td className="py-2">{formatDateBR(row.prazo)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
