"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import { dataOf, usePbiQuery } from "@/hooks/use-pbi";
import {
  absoluteFichaVidaUrl,
  agregarEtiquetasPlano,
  formatMesAno,
  formatProximaLabel,
} from "@/lib/etiquetas/agregar-plano";
import {
  loadNiimbot,
  printPngOnNiimbotB1,
  webBluetoothSupported,
} from "@/lib/etiquetas/niimbot-client";
import { downloadDataUrl, drawLabelToCanvas, labelToPngDataUrl } from "@/lib/etiquetas/render-label";
import {
  LABEL_SIZES_B1,
  PLANOS_ETIQUETA,
  type EtiquetaEquipamento,
  type LabelSizeId,
  type PlanoEtiqueta,
} from "@/lib/etiquetas/tipos";
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { nowInSaoPaulo, parsePbiDate } from "@/lib/pbi/dates";
import type { CronogramaItem } from "@/lib/pbi/types";
import { cn } from "@/lib/utils";

const BRAND = "HSJ · Eng. Clínica";

function currentMonthKey(today = nowInSaoPaulo()) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions(year: number) {
  return Array.from({ length: 12 }, (_, month) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = new Date(year, month, 1).toLocaleDateString("pt-BR", {
      month: "short",
      year: "numeric",
    });
    return { key, label };
  });
}

function chipTone(plano: PlanoEtiqueta): "info" | "ok" | "warn" {
  if (plano === "preventiva") return "info";
  if (plano === "calibracao") return "ok";
  return "warn";
}

export function EtiquetasPlanoView() {
  const today = useMemo(() => nowInSaoPaulo(), []);
  const year = today.getFullYear();
  const { range, raw, loading, error } = useOsAnaliticoRollingYear("calendarYear");

  const cronoFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      from: "",
      to: "",
      tipoManutencao: "Todos" as const,
      somenteMedicos: false,
    }),
    [],
  );
  const cronoQ = usePbiQuery<CronogramaItem[]>("cronograma", cronoFilters, {
    qtdPorPagina: "100000",
  });

  const [months, setMonths] = useState<string[]>(() => [currentMonthKey(today)]);
  const [planosOn, setPlanosOn] = useState<Record<PlanoEtiqueta, boolean>>({
    preventiva: true,
    calibracao: true,
    tse: true,
  });
  const [sizeId, setSizeId] = useState<LabelSizeId>("50x30");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [bleOk, setBleOk] = useState(false);
  const [pending, setPending] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setBleOk(webBluetoothSupported());
  }, []);

  const size = LABEL_SIZES_B1.find((s) => s.id === sizeId) ?? LABEL_SIZES_B1[0]!;
  const monthsOpts = monthOptions(year);

  const planosAtivos = useMemo(
    () => PLANOS_ETIQUETA.map((p) => p.id).filter((id) => planosOn[id]),
    [planosOn],
  );

  const cronogramaProximas = useMemo(() => {
    const crono = dataOf(cronoQ.data) ?? [];
    const map = new Map<string, Date | null>();
    for (const c of crono) {
      const tag = (c.Tag ?? "").trim();
      if (!tag) continue;
      const d = parsePbiDate(c.ProximaRealizacao);
      if (!d) continue;
      const prev = map.get(tag);
      if (!prev || d.getTime() < prev.getTime()) map.set(tag, d);
    }
    return [...map.entries()].map(([tag, proxima]) => ({ tag, proxima }));
  }, [cronoQ.data]);

  const rows = useMemo(
    () =>
      agregarEtiquetasPlano(raw, {
        monthKeys: months,
        planos: planosAtivos,
        cronogramaProximas,
      }),
    [raw, months, planosAtivos, cronogramaProximas],
  );

  const selected = rows.find((r) => r.tag === selectedTag) ?? rows[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    if (!selectedTag || !rows.some((r) => r.tag === selectedTag)) {
      setSelectedTag(selected.tag);
    }
  }, [selected, selectedTag, rows]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const renderInput = useMemo(() => {
    if (!selected) return null;
    return {
      brand: BRAND,
      tag: selected.tag,
      equipamento: selected.equipamento,
      planos: selected.planos,
      realizacaoLabel: formatMesAno(selected.realizacao),
      proximaLabel: formatProximaLabel(selected.proxima),
      qrUrl: absoluteFichaVidaUrl(selected.fichaVidaPath, origin),
      size,
    };
  }, [selected, origin, size]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !renderInput) return;
    let cancelled = false;
    void drawLabelToCanvas(canvas, renderInput).catch((err) => {
      if (!cancelled) setStatus(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [renderInput]);

  function toggleMonth(key: string) {
    setMonths((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== key);
      }
      return [...prev, key].sort();
    });
  }

  async function withLabel(
    row: EtiquetaEquipamento,
    action: (dataUrl: string) => Promise<void>,
  ) {
    const input = {
      brand: BRAND,
      tag: row.tag,
      equipamento: row.equipamento,
      planos: row.planos,
      realizacaoLabel: formatMesAno(row.realizacao),
      proximaLabel: formatProximaLabel(row.proxima),
      qrUrl: absoluteFichaVidaUrl(row.fichaVidaPath, window.location.origin),
      size,
    };
    const dataUrl = await labelToPngDataUrl(input);
    await action(dataUrl);
  }

  async function onDownload(row: EtiquetaEquipamento) {
    setPending(true);
    try {
      setStatus(`Gerando PNG · ${row.tag}…`);
      await withLabel(row, async (dataUrl) => {
        downloadDataUrl(dataUrl, `etiqueta-${row.tag}-${size.id}.png`);
      });
      setStatus(`PNG baixado · ${row.tag}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function onPrintOne(row: EtiquetaEquipamento) {
    setPending(true);
    try {
      setStatus(`Imprimindo ${row.tag} na B1…`);
      await withLabel(row, async (dataUrl) => {
        await printPngOnNiimbotB1(dataUrl, size, {
          onProgress: (s) => setStatus(`${row.tag}: ${s}`),
        });
      });
      setStatus(`Impresso · ${row.tag}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function onPrintSelected() {
    if (!selected) return;
    void onPrintOne(selected);
  }

  async function onConnect() {
    setPending(true);
    try {
      setStatus("Conectando à Niimbot B1…");
      const Niimbot = await loadNiimbot();
      await Niimbot.identify({
        label: "Niimbot B1",
        id: 4096,
        dpi: 203,
        task: "b1",
        density: 3,
        label_type: 1,
        speed: 1,
        name_prefixes: ["B1"],
      });
      const info = Niimbot.printer;
      setStatus(
        info
          ? `Conectada: ${info.label ?? "B1"} · id ${info.modelId} · ${info.dpi} dpi`
          : "Conectada",
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function onDownloadAll() {
    setPending(true);
    try {
      setStatus(`Baixando ${rows.length} PNG…`);
      for (const row of rows) {
        await withLabel(row, async (dataUrl) => {
          downloadDataUrl(dataUrl, `etiqueta-${row.tag}-${size.id}.png`);
        });
        await new Promise((r) => setTimeout(r, 120));
      }
      setStatus(`${rows.length} PNG baixados`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Etiquetas · plano Preventiva / Cal / TSE"
        description="Gera etiquetas a partir de OS abertas das oficinas PREVENTIVA EQUIPAMENTOS, CALIBRAÇÃO DE EQUIPAMENTOS e SEGURANÇA ELÉTRICA. QR aponta para a ficha vida do equipamento. Impressão Web Bluetooth na Niimbot B1 (Chrome/Edge + HTTPS). Guia: docs/ops/etiquetas-niimbot.md."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-aion-muted">
              Meses ({year})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {monthsOpts.map((m) => {
                const on = months.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMonth(m.key)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                      on
                        ? "border-aion-blue bg-aion-blue text-white"
                        : "border-aion-line bg-white text-aion-ink hover:bg-aion-mist",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setMonths([currentMonthKey(today)])}
              >
                Mês atual
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-aion-muted">
              Tipos de plano
            </p>
            <div className="flex flex-wrap gap-2">
              {PLANOS_ETIQUETA.map((p) => (
                <label
                  key={p.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-aion-line bg-white px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={planosOn[p.id]}
                    onChange={(e) =>
                      setPlanosOn((prev) => ({ ...prev, [p.id]: e.target.checked }))
                    }
                  />
                  <span>{p.chipLabel}</span>
                  <Badge tone={chipTone(p.id)}>{p.chip}</Badge>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-aion-muted">
              Tamanho da etiqueta (B1)
            </p>
            <div className="flex flex-wrap gap-2">
              {LABEL_SIZES_B1.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSizeId(s.id)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    sizeId === s.id
                      ? "border-aion-blue bg-aion-mist text-aion-blue"
                      : "border-aion-line bg-white",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-aion-muted">
            Fonte: <code className="text-[11px]">/api/pbi/os-analitico</code> · ano vigente{" "}
            {range.label} · abertas = sem Fechamento/DataDaSolucao e não canceladas.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>
              Equipamentos ({loading ? "…" : rows.length})
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={pending || !rows.length} onClick={onDownloadAll}>
                Baixar PNG (todos)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-rose-700">{error}</p>
            ) : null}
            {loading ? (
              <TableSkeleton rows={8} />
            ) : rows.length === 0 ? (
              <p className="text-sm text-aion-muted">
                Nenhuma OS aberta de plano nos meses/tipos selecionados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-aion-muted">
                    <tr>
                      <th className="py-2 pr-2">Tag</th>
                      <th className="py-2 pr-2">Equipamento</th>
                      <th className="py-2 pr-2">Setor</th>
                      <th className="py-2 pr-2">Planos</th>
                      <th className="py-2 pr-2">Realiz.</th>
                      <th className="py-2 pr-2">Próxima</th>
                      <th className="py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.tag}
                        className={cn(
                          "border-t border-aion-line/70 cursor-pointer",
                          selected?.tag === row.tag ? "bg-aion-mist/70" : "hover:bg-aion-mist/40",
                        )}
                        onClick={() => setSelectedTag(row.tag)}
                      >
                        <td className="py-2 pr-2 font-mono text-xs">
                          <Link
                            href={row.fichaVidaPath}
                            className="text-aion-blue hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.tag}
                          </Link>
                        </td>
                        <td className="py-2 pr-2 max-w-[12rem] truncate" title={row.equipamento}>
                          {row.equipamento || "—"}
                        </td>
                        <td className="py-2 pr-2">{row.setor || "—"}</td>
                        <td className="py-2 pr-2">
                          <span className="inline-flex flex-wrap gap-1">
                            {row.planos.map((p) => {
                              const cfg = PLANOS_ETIQUETA.find((x) => x.id === p);
                              return (
                                <Badge key={p} tone={chipTone(p)}>
                                  {cfg?.chip}
                                </Badge>
                              );
                            })}
                          </span>
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">{formatMesAno(row.realizacao)}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">{formatProximaLabel(row.proxima)}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={pending}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownload(row);
                              }}
                            >
                              PNG
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={pending || !bleOk}
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintOne(row);
                              }}
                              title={bleOk ? "Imprimir na B1" : "Web Bluetooth indisponível"}
                            >
                              B1
                            </Button>
                          </div>
                        </td>
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
            <CardTitle>Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-center rounded-lg border border-dashed border-aion-line bg-[linear-gradient(180deg,#f8fbfd,#eef5fa)] p-4">
              <canvas
                ref={previewRef}
                className="max-w-full border border-aion-line bg-white shadow-sm"
                style={{
                  width: size.wMm * 3.2,
                  height: size.hMm * 3.2,
                  imageRendering: "pixelated",
                }}
              />
            </div>
            {selected ? (
              <p className="text-xs text-aion-muted break-all">
                QR →{" "}
                <Link href={selected.fichaVidaPath} className="text-aion-blue hover:underline">
                  {absoluteFichaVidaUrl(selected.fichaVidaPath, origin || undefined)}
                </Link>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending || !bleOk} onClick={onConnect}>
                Conectar B1
              </Button>
              <Button type="button" disabled={pending || !selected || !bleOk} onClick={onPrintSelected}>
                Imprimir selecionada
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !selected}
                onClick={() => selected && onDownload(selected)}
              >
                Baixar PNG
              </Button>
            </div>

            {!bleOk ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Web Bluetooth não disponível neste navegador. Use <strong>Chrome</strong> ou{" "}
                <strong>Edge</strong> em <strong>HTTPS</strong> (Railway/Coolify) ou localhost.
                Enquanto isso, baixe o PNG e imprima pelo app Niimbot.
              </p>
            ) : (
              <p className="text-xs text-aion-muted">
                Bluetooth OK. A impressão exige gesto do usuário (clique). Ver{" "}
                <code className="text-[11px]">docs/ops/etiquetas-niimbot.md</code>.
              </p>
            )}

            {status ? (
              <p className="rounded-md border border-aion-line bg-aion-mist/50 px-3 py-2 text-xs text-aion-ink">
                {status}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
