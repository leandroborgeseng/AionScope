"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import { dataOf, usePbiQuery } from "@/hooks/use-pbi";
import {
  agregarEtiquetasPlano,
  formatMesAno,
  formatProximaLabel,
} from "@/lib/etiquetas/agregar-plano";
import {
  loadNiimbot,
  printPngBatchOnNiimbotB1,
  printPngOnNiimbotB1,
  webBluetoothSupported,
} from "@/lib/etiquetas/niimbot-client";
import { etiquetaBranding } from "@/lib/etiquetas/branding";
import { resolveEtiquetaQrUrl } from "@/lib/etiquetas/qr-url";
import {
  downloadDataUrl,
  drawLabelPreviewToCanvas,
  LABEL_PREVIEW_PX_PER_MM,
  labelToPngDataUrl,
} from "@/lib/etiquetas/render-label";
import {
  LABEL_SIZES_B1,
  PLANOS_ETIQUETA,
  type EtiquetaEquipamento,
  type LabelRenderInput,
  type LabelSizeId,
  type PlanoEtiqueta,
} from "@/lib/etiquetas/tipos";
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { nowInSaoPaulo, parsePbiDate } from "@/lib/pbi/dates";
import type { CronogramaItem, EquipamentoItem } from "@/lib/pbi/types";
import { cn } from "@/lib/utils";

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

const PAGE_SIZE = 12;

type SortKey = "tag" | "equipamento" | "setor" | "realizacao" | "proxima";

function compareRows(a: EtiquetaEquipamento, b: EtiquetaEquipamento, key: SortKey): number {
  switch (key) {
    case "tag":
      return a.tag.localeCompare(b.tag, "pt-BR");
    case "equipamento":
      return a.equipamento.localeCompare(b.equipamento, "pt-BR");
    case "setor": {
      const setor = a.setor.localeCompare(b.setor, "pt-BR");
      return setor !== 0 ? setor : a.tag.localeCompare(b.tag, "pt-BR");
    }
    case "realizacao":
      return (a.realizacao?.getTime() ?? 0) - (b.realizacao?.getTime() ?? 0);
    case "proxima":
      return (a.proxima?.getTime() ?? 0) - (b.proxima?.getTime() ?? 0);
    default:
      return 0;
  }
}

export function EtiquetasPlanoView() {
  const today = useMemo(() => nowInSaoPaulo(), []);
  const year = today.getFullYear();
  const branding = useMemo(() => etiquetaBranding(), []);
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

  /** Cadastro: Id / CodigoCliente para deep link Effort no QR (API não traz URL). */
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
  const eqQ = usePbiQuery<EquipamentoItem[]>("equipamentos", eqFilters, {
    apenasAtivos: "false",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "false",
    qtdPorPagina: "100000",
  });

  const eqByTag = useMemo(() => {
    const map = new Map<string, EquipamentoItem>();
    for (const item of dataOf(eqQ.data) ?? []) {
      const key = (item.Tag ?? "").trim().toLocaleUpperCase("pt-BR");
      if (key) map.set(key, item);
    }
    return map;
  }, [eqQ.data]);

  const [months, setMonths] = useState<string[]>(() => [currentMonthKey(today)]);
  const [planosOn, setPlanosOn] = useState<Record<PlanoEtiqueta, boolean>>({
    preventiva: true,
    calibracao: true,
    tse: true,
  });
  /** Primário: 50×30 mm (B1). 40×30 opcional. */
  const [sizeId, setSizeId] = useState<LabelSizeId>("50x30");
  /** Filtro de setor na lista de impressão (`todos` = sem filtro). */
  const [setorFiltro, setSetorFiltro] = useState("todos");
  /** Busca rápida por tag, equipamento ou setor. */
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("setor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  /** Linha em foco no mockup (clique na tabela). */
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  /** Tags marcadas para impressão em lote. */
  const [checkedTags, setCheckedTags] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [bleOk, setBleOk] = useState(false);
  const [pending, setPending] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const cancelBatchRef = useRef(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  /** Garante redraw quando o <canvas> monta (ref sozinho não re-dispara effect). */
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  /** Redraw hi-DPI quando a caixa CSS ou o DPR mudam. */
  const [previewLayoutTick, setPreviewLayoutTick] = useState(0);
  const bindPreviewCanvas = useCallback((node: HTMLCanvasElement | null) => {
    previewRef.current = node;
    setPreviewCanvas((prev) => (prev === node ? prev : node));
  }, []);

  useEffect(() => {
    setBleOk(webBluetoothSupported());
  }, []);

  useEffect(() => {
    const canvas = previewCanvas;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    let lastW = -1;
    let lastH = -1;
    const bumpLayout = () => {
      const box = canvas.parentElement ?? canvas;
      const w = box.clientWidth;
      const h = box.clientHeight;
      // Ignora mudanças só do bitmap (canvas.width); redesenha se a caixa CSS mudou.
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPreviewLayoutTick((t) => t + 1));
    };
    const ro = new ResizeObserver(bumpLayout);
    ro.observe(canvas.parentElement ?? canvas);
    const onDpr = () => setPreviewLayoutTick((t) => t + 1);
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener?.("change", onDpr);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mq.removeEventListener?.("change", onDpr);
    };
  }, [previewCanvas]);

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

  const rowsBase = useMemo(
    () =>
      agregarEtiquetasPlano(raw, {
        monthKeys: months,
        planos: planosAtivos,
        cronogramaProximas,
      }),
    [raw, months, planosAtivos, cronogramaProximas],
  );

  /** Completa setor vazio com o cadastro de equipamentos. */
  const rowsEnriched = useMemo(
    () =>
      rowsBase.map((row) => {
        if (row.setor) return row;
        const eq = eqByTag.get(row.tag.trim().toLocaleUpperCase("pt-BR"));
        const setor = (eq?.Setor ?? "").trim();
        return setor ? { ...row, setor } : row;
      }),
    [rowsBase, eqByTag],
  );

  const setoresOpts = useMemo(() => {
    const set = new Set<string>();
    for (const row of rowsEnriched) {
      if (row.setor) set.add(row.setor);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rowsEnriched]);

  useEffect(() => {
    if (setorFiltro !== "todos" && !setoresOpts.includes(setorFiltro)) {
      setSetorFiltro("todos");
    }
  }, [setorFiltro, setoresOpts]);

  const rows = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return rowsEnriched.filter((row) => {
      if (setorFiltro !== "todos" && row.setor !== setorFiltro) return false;
      if (!q) return true;
      return (
        row.tag.toLocaleLowerCase("pt-BR").includes(q) ||
        row.equipamento.toLocaleLowerCase("pt-BR").includes(q) ||
        row.setor.toLocaleLowerCase("pt-BR").includes(q)
      );
    });
  }, [rowsEnriched, setorFiltro, busca]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => compareRows(a, b, sortKey) * dir);
    return list;
  }, [rows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => sortedRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [sortedRows, safePage],
  );

  useEffect(() => {
    setPage(0);
  }, [setorFiltro, busca, months, planosAtivos, sortKey, sortDir]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const selected = sortedRows.find((r) => r.tag === selectedTag) ?? sortedRows[0] ?? null;
  const visibleTags = useMemo(() => sortedRows.map((r) => r.tag), [sortedRows]);
  const pageTags = useMemo(() => pageRows.map((r) => r.tag), [pageRows]);
  const checkedCount = useMemo(
    () => visibleTags.reduce((n, tag) => n + (checkedTags.has(tag) ? 1 : 0), 0),
    [visibleTags, checkedTags],
  );
  const allVisibleChecked =
    visibleTags.length > 0 && visibleTags.every((tag) => checkedTags.has(tag));
  const allPageChecked =
    pageTags.length > 0 && pageTags.every((tag) => checkedTags.has(tag));
  const pageCheckedCount = useMemo(
    () => pageTags.reduce((n, tag) => n + (checkedTags.has(tag) ? 1 : 0), 0),
    [pageTags, checkedTags],
  );

  useEffect(() => {
    if (!selected) return;
    if (!selectedTag || !sortedRows.some((r) => r.tag === selectedTag)) {
      setSelectedTag(selected.tag);
    }
  }, [selected, selectedTag, sortedRows]);

  /** Remove da seleção em lote tags que saíram do filtro. */
  useEffect(() => {
    const visible = new Set(visibleTags);
    setCheckedTags((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const tag of prev) {
        if (visible.has(tag)) next.add(tag);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visibleTags]);

  function toggleChecked(tag: string) {
    setCheckedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function selectAllVisible() {
    setCheckedTags(new Set(visibleTags));
  }

  function clearChecked() {
    setCheckedTags(new Set());
  }

  function togglePageChecked() {
    setCheckedTags((prev) => {
      const next = new Set(prev);
      if (allPageChecked) {
        for (const tag of pageTags) next.delete(tag);
      } else {
        for (const tag of pageTags) next.add(tag);
      }
      return next;
    });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function qrForRow(row: EtiquetaEquipamento | null, tagFallback: string) {
    const tag = row?.tag ?? tagFallback;
    const fichaPath = row?.fichaVidaPath ?? `/equipamentos/${encodeURIComponent(tag)}`;
    const eq = eqByTag.get(tag.trim().toLocaleUpperCase("pt-BR"));
    return resolveEtiquetaQrUrl({
      tag,
      id: eq?.Id,
      codigoCliente: eq?.CodigoCliente,
      fichaVidaPath: fichaPath,
      origin: origin || undefined,
    });
  }

  function buildRenderInput(row: EtiquetaEquipamento | null): LabelRenderInput {
    const tag = row?.tag ?? "EQ-DEMO";
    const equipamento = row?.equipamento || "Monitor multiparamétrico";
    const planos = row?.planos?.length
      ? row.planos
      : (["preventiva", "calibracao"] as PlanoEtiqueta[]);
    const realizacao = row?.realizacao ?? new Date(year, today.getMonth(), 1);
    const proxima = row?.proxima ?? new Date(year + 1, today.getMonth(), 15);
    const qr = qrForRow(row, tag);
    return {
      brand: branding.brand,
      site: branding.site,
      telefone: branding.telefone,
      logoUrl: branding.logoUrl,
      tag,
      equipamento,
      planos,
      realizacaoLabel: formatMesAno(realizacao),
      proximaLabel: formatProximaLabel(proxima),
      qrUrl: qr.url,
      size,
    };
  }

  const selectedQr = useMemo(
    () => (selected ? qrForRow(selected, selected.tag) : null),
    [selected, eqByTag, origin],
  );

  const renderInput = useMemo(
    () => buildRenderInput(selected),
    [selected, origin, size, branding, year, today, eqByTag],
  );

  useEffect(() => {
    const canvas = previewCanvas ?? previewRef.current;
    if (!canvas || !renderInput) return;
    let cancelled = false;
    void drawLabelPreviewToCanvas(canvas, renderInput)
      .then(() => {
        if (!cancelled) {
          setStatus((s) => (s && /canvas|font|QR|etiqueta|NetworkError/i.test(s) ? null : s));
        }
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [renderInput, previewCanvas, previewLayoutTick]);

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
    const input = buildRenderInput(row);
    const qr = resolveEtiquetaQrUrl({
      tag: row.tag,
      id: eqByTag.get(row.tag.trim().toLocaleUpperCase("pt-BR"))?.Id,
      codigoCliente: eqByTag.get(row.tag.trim().toLocaleUpperCase("pt-BR"))?.CodigoCliente,
      fichaVidaPath: row.fichaVidaPath,
      origin: window.location.origin,
    });
    input.qrUrl = qr.url;
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

  function onPrintFocused() {
    if (!selected) return;
    void onPrintOne(selected);
  }

  async function onPrintChecked() {
    const selectedRows = sortedRows.filter((r) => checkedTags.has(r.tag));
    if (!selectedRows.length) return;

    cancelBatchRef.current = false;
    setBatchRunning(true);
    setPending(true);
    const total = selectedRows.length;
    const errors: string[] = [];

    try {
      setStatus(`Preparando ${total} etiqueta${total === 1 ? "" : "s"}…`);
      const items: { tag: string; dataUrl: string }[] = [];
      for (let i = 0; i < selectedRows.length; i++) {
        if (cancelBatchRef.current) {
          setStatus(`Cancelado na preparação · ${i} de ${total} geradas`);
          return;
        }
        const row = selectedRows[i]!;
        setStatus(`Gerando PNG ${i + 1} de ${total} · ${row.tag}…`);
        const input = buildRenderInput(row);
        const qr = qrForRow(row, row.tag);
        input.qrUrl = qr.url;
        items.push({ tag: row.tag, dataUrl: await labelToPngDataUrl(input) });
      }

      const results = await printPngBatchOnNiimbotB1(items, size, {
        shouldCancel: () => cancelBatchRef.current,
        onProgress: (info) => setStatus(info.detail),
      });

      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok && !r.skipped);
      const skipped = results.filter((r) => r.skipped).length;
      for (const r of failed) {
        errors.push(`${r.tag}: ${r.error ?? "erro"}`);
      }

      if (cancelBatchRef.current || skipped > 0) {
        setStatus(
          `Cancelado · ${ok} impressa${ok === 1 ? "" : "s"} de ${total}` +
            (failed.length ? ` · ${failed.length} erro(s)` : ""),
        );
      } else if (failed.length === 0) {
        setStatus(`${ok} etiqueta${ok === 1 ? "" : "s"} impressa${ok === 1 ? "" : "s"} na B1`);
      } else {
        setStatus(
          `${ok} ok · ${failed.length} erro(s) de ${total}` +
            (errors.length ? ` — ${errors.slice(0, 3).join("; ")}` : ""),
        );
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBatchRunning(false);
      setPending(false);
      cancelBatchRef.current = false;
    }
  }

  function onCancelBatch() {
    cancelBatchRef.current = true;
    setStatus("Cancelando após a etiqueta atual…");
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
        density: 2,
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

  async function onDownloadRows(list: EtiquetaEquipamento[], label: string) {
    if (!list.length) return;
    setPending(true);
    try {
      setStatus(`Baixando ${list.length} PNG (${label})…`);
      for (const row of list) {
        await withLabel(row, async (dataUrl) => {
          downloadDataUrl(dataUrl, `etiqueta-${row.tag}-${size.id}.png`);
        });
        await new Promise((r) => setTimeout(r, 120));
      }
      setStatus(`${list.length} PNG baixados`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function onDownloadSelected() {
    const list = sortedRows.filter((r) => checkedTags.has(r.tag));
    await onDownloadRows(list, "selecionadas");
  }

  async function onDownloadAllFiltered() {
    await onDownloadRows(sortedRows, "filtradas");
  }

  const showMobileBar = checkedCount > 0 || batchRunning;

  return (
    <div className={cn("space-y-4 sm:space-y-5", showMobileBar && "pb-24 lg:pb-0")}>
      <PageHeader
        title="Etiquetas · plano Preventiva / Cal / TSE"
        description="Filtre por setor, marque equipamentos e imprima na Niimbot B1 (Chrome/Edge com Bluetooth) ou baixe PNG. No celular, use a barra inferior para a fila de impressão."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-end">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-aion-muted">
              Setor
              <select
                className="h-11 w-full rounded-lg border border-aion-line bg-white px-3 text-sm font-normal normal-case tracking-normal text-aion-ink"
                value={setorFiltro}
                onChange={(e) => setSetorFiltro(e.target.value)}
                disabled={loading || setoresOpts.length === 0}
              >
                <option value="todos">Todos os setores</option>
                {setoresOpts.map((setor) => (
                  <option key={setor} value={setor}>
                    {setor}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-aion-muted">
              Buscar
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Tag, equipamento ou setor…"
                className="h-11 w-full rounded-lg border border-aion-line bg-white px-3 text-sm font-normal normal-case tracking-normal text-aion-ink placeholder:text-aion-muted"
              />
            </label>
            {(setorFiltro !== "todos" || busca.trim()) && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-11 sm:self-end"
                onClick={() => {
                  setSetorFiltro("todos");
                  setBusca("");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

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
                      "min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
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
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-aion-line bg-white px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
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
                    "min-h-11 rounded-md border px-3 py-2 text-sm",
                    sizeId === s.id
                      ? "border-aion-blue bg-aion-blue text-white"
                      : "border-aion-line bg-white text-aion-ink hover:bg-aion-mist",
                    s.id === "50x30" && sizeId !== "50x30" ? "ring-1 ring-aion-blue/25" : "",
                  )}
                >
                  {s.label}
                  {s.id === "50x30" ? " · principal" : ""}
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

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,360px)] lg:gap-5">
        <Card className="order-2 min-w-0 lg:order-1">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <CardTitle className="text-base sm:text-lg">
              Equipamentos ({loading ? "…" : sortedRows.length}
              {!loading && sortedRows.length !== rowsEnriched.length
                ? ` de ${rowsEnriched.length}`
                : ""}
              )
              {checkedCount > 0 ? (
                <span className="ml-2 text-sm font-normal text-aion-muted">
                  · {checkedCount} sel.
                </span>
              ) : null}
            </CardTitle>
            <div className="hidden flex-wrap gap-2 lg:flex">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !sortedRows.length}
                onClick={selectAllVisible}
              >
                Selecionar todas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || checkedCount === 0}
                onClick={clearChecked}
              >
                Limpar seleção
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || checkedCount === 0 || !bleOk}
                onClick={() => void onPrintChecked()}
              >
                Imprimir sel.{checkedCount > 0 ? ` (${checkedCount})` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending || checkedCount === 0}
                onClick={() => void onDownloadSelected()}
              >
                PNG sel.
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !sortedRows.length}
                onClick={() => void onDownloadAllFiltered()}
              >
                PNG filtradas
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 lg:hidden">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !sortedRows.length}
                onClick={selectAllVisible}
              >
                Sel. todas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || checkedCount === 0}
                onClick={clearChecked}
              >
                Limpar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {loading ? (
              <TableSkeleton rows={6} />
            ) : sortedRows.length === 0 ? (
              <p className="text-sm text-aion-muted">
                Nenhuma OS aberta de plano nos filtros selecionados.
              </p>
            ) : (
              <>
                {/* Lista em cards — mobile */}
                <ul className="space-y-2 md:hidden">
                  {pageRows.map((row) => {
                    const active = selected?.tag === row.tag;
                    const checked = checkedTags.has(row.tag);
                    return (
                      <li key={row.tag}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedTag(row.tag)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedTag(row.tag);
                            }
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left transition-colors",
                            active
                              ? "border-aion-blue bg-aion-mist/80"
                              : "border-aion-line bg-white",
                            checked && !active ? "bg-sky-50/90" : "",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-5 w-5"
                              checked={checked}
                              disabled={pending}
                              onChange={() => toggleChecked(row.tag)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Selecionar ${row.tag}`}
                            />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <Link
                                  href={row.fichaVidaPath}
                                  className="font-mono text-sm font-semibold text-aion-blue"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {row.tag}
                                </Link>
                                <span className="text-xs text-aion-muted">
                                  {row.setor || "Sem setor"}
                                </span>
                              </div>
                              <p className="truncate text-sm text-aion-ink">
                                {row.equipamento || "—"}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {row.planos.map((p) => {
                                  const cfg = PLANOS_ETIQUETA.find((x) => x.id === p);
                                  return (
                                    <Badge key={p} tone={chipTone(p)}>
                                      {cfg?.chip}
                                    </Badge>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-aion-muted">
                                Realiz. {formatMesAno(row.realizacao)} · Próx.{" "}
                                {formatProximaLabel(row.proxima)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Tabela — desktop */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-aion-muted">
                      <tr>
                        <th className="w-10 py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={allPageChecked}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate =
                                  pageCheckedCount > 0 && !allPageChecked;
                              }
                            }}
                            disabled={pending || !pageRows.length}
                            onChange={togglePageChecked}
                            aria-label="Selecionar página atual"
                            className="align-middle"
                          />
                        </th>
                        {(
                          [
                            ["tag", "Tag"],
                            ["equipamento", "Equipamento"],
                            ["setor", "Setor"],
                          ] as const
                        ).map(([key, label]) => (
                          <th key={key} className="py-2 pr-2">
                            <button
                              type="button"
                              className="font-semibold uppercase tracking-wide hover:text-aion-blue"
                              onClick={() => toggleSort(key)}
                            >
                              {label}
                              {sortMark(key)}
                            </button>
                          </th>
                        ))}
                        <th className="py-2 pr-2">Planos</th>
                        {(
                          [
                            ["realizacao", "Realiz."],
                            ["proxima", "Próxima"],
                          ] as const
                        ).map(([key, label]) => (
                          <th key={key} className="py-2 pr-2">
                            <button
                              type="button"
                              className="font-semibold uppercase tracking-wide hover:text-aion-blue"
                              onClick={() => toggleSort(key)}
                            >
                              {label}
                              {sortMark(key)}
                            </button>
                          </th>
                        ))}
                        <th className="py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => (
                        <tr
                          key={row.tag}
                          className={cn(
                            "cursor-pointer border-t border-aion-line/70",
                            selected?.tag === row.tag
                              ? "bg-aion-mist/70"
                              : "hover:bg-aion-mist/40",
                            checkedTags.has(row.tag) && selected?.tag !== row.tag
                              ? "bg-sky-50/80"
                              : "",
                          )}
                          onClick={() => setSelectedTag(row.tag)}
                        >
                          <td className="py-2 pr-2">
                            <input
                              type="checkbox"
                              checked={checkedTags.has(row.tag)}
                              disabled={pending}
                              onChange={() => toggleChecked(row.tag)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Selecionar ${row.tag}`}
                              className="align-middle"
                            />
                          </td>
                          <td className="py-2 pr-2 font-mono text-xs">
                            <Link
                              href={row.fichaVidaPath}
                              className="text-aion-blue hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.tag}
                            </Link>
                          </td>
                          <td
                            className="max-w-[12rem] truncate py-2 pr-2"
                            title={row.equipamento}
                          >
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
                          <td className="whitespace-nowrap py-2 pr-2">
                            {formatMesAno(row.realizacao)}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-2">
                            {formatProximaLabel(row.proxima)}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onDownload(row);
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
                                  void onPrintOne(row);
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

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-aion-muted">
                  <span>
                    {sortedRows.length} registro(s) · página {safePage + 1} de {pageCount}
                    {allVisibleChecked ? " · todas filtradas selecionadas" : ""}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={safePage <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="order-1 min-w-0 lg:sticky lg:top-4 lg:order-2 lg:self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Mockup · {size.label}</CardTitle>
            <p className="text-xs text-aion-muted">
              Prévia hi-DPI; impressão B1 {size.wPx}×{size.hPx} @ 203 dpi. Caixas: Manut.
              Preventiva / Calibração / Teste Seg. Elétrica.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-aion-line bg-[linear-gradient(165deg,#e8f2f8_0%,#f4f8fb_45%,#eef5fa_100%)] p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-aion-muted">
                <span>Etiqueta</span>
                <span>
                  {size.wMm} × {size.hMm} mm
                </span>
              </div>
              <div className="flex justify-center">
                <div
                  className="relative bg-white shadow-[0_8px_28px_rgba(1,104,176,0.12)] ring-1 ring-aion-ink/15"
                  style={{
                    width: size.wMm * LABEL_PREVIEW_PX_PER_MM,
                    aspectRatio: `${size.wMm} / ${size.hMm}`,
                    maxWidth: "100%",
                  }}
                >
                  <canvas
                    ref={bindPreviewCanvas}
                    className="block h-full w-full"
                    aria-label={`Pré-visualização da etiqueta ${size.label}`}
                  />
                </div>
              </div>
              <p className="mt-3 text-center text-[11px] text-aion-muted">
                {branding.telefone || "(16) 3030-0445"} ·{" "}
                {(branding.site || "aion.eng.br").replace(/^www\./, "")}
              </p>
            </div>

            {selected && selectedQr ? (
              <div className="space-y-1 break-all text-xs text-aion-muted">
                <p>
                  QR →{" "}
                  {selectedQr.source === "effort-template" ? (
                    <a
                      href={selectedQr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-aion-blue hover:underline"
                    >
                      {selectedQr.url}
                    </a>
                  ) : (
                    <Link href={selected.fichaVidaPath} className="text-aion-blue hover:underline">
                      {selectedQr.url}
                    </Link>
                  )}{" "}
                  <Badge tone={selectedQr.source === "effort-template" ? "ok" : "info"}>
                    {selectedQr.source === "effort-template" ? "Effort" : "Ficha vida"}
                  </Badge>
                </p>
                {selectedQr.source === "effort-template" ? (
                  <p>
                    Ficha AionScope:{" "}
                    <Link href={selected.fichaVidaPath} className="text-aion-blue hover:underline">
                      {selectedQr.fichaVidaUrl}
                    </Link>
                  </p>
                ) : (
                  <p className="hidden sm:block">
                    Sem Id na API — QR usa ficha vida. Ver{" "}
                    <code className="text-[11px]">docs/ops/etiquetas-niimbot.md</code>.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-aion-muted">
                Toque em um equipamento na lista para ver a etiqueta real.
              </p>
            )}

            <div className="hidden flex-wrap gap-2 lg:flex">
              <Button type="button" variant="outline" disabled={pending || !bleOk} onClick={onConnect}>
                Conectar B1
              </Button>
              <Button
                type="button"
                disabled={pending || !selected || !bleOk}
                onClick={onPrintFocused}
              >
                Imprimir esta
              </Button>
              <Button
                type="button"
                disabled={pending || checkedCount === 0 || !bleOk}
                onClick={() => void onPrintChecked()}
              >
                Imprimir sel.{checkedCount > 0 ? ` (${checkedCount})` : ""}
              </Button>
              {batchRunning ? (
                <Button type="button" variant="outline" onClick={onCancelBatch}>
                  Cancelar fila
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !selected}
                onClick={() => selected && void onDownload(selected)}
              >
                PNG desta
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 lg:hidden">
              <Button
                type="button"
                className="min-h-11 flex-1"
                variant="outline"
                disabled={pending || !bleOk}
                onClick={onConnect}
              >
                Conectar B1
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={pending || !selected || !bleOk}
                onClick={onPrintFocused}
              >
                Imprimir esta
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1"
                variant="secondary"
                disabled={pending || !selected}
                onClick={() => selected && void onDownload(selected)}
              >
                PNG desta
              </Button>
            </div>

            {!bleOk ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Web Bluetooth indisponível aqui. No <strong>Android</strong>, use Chrome/Edge em
                HTTPS. No <strong>iPhone</strong>, baixe PNG e imprima pelo app Niimbot (Safari não
                tem Bluetooth web).
              </p>
            ) : (
              <p className="text-xs text-aion-muted">
                Bluetooth OK — a impressão exige toque/clique do usuário.
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

      {/* Barra fixa de ações — mobile */}
      {showMobileBar ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-aion-line bg-white/95 px-3 pt-3 shadow-[0_-8px_24px_rgba(1,104,176,0.12)] backdrop-blur lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11 flex-[1.4]"
              disabled={pending || checkedCount === 0 || !bleOk}
              onClick={() => void onPrintChecked()}
            >
              Imprimir {checkedCount > 0 ? `(${checkedCount})` : ""}
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              variant="secondary"
              disabled={pending || checkedCount === 0}
              onClick={() => void onDownloadSelected()}
            >
              PNG sel.
            </Button>
            {batchRunning ? (
              <Button type="button" className="min-h-11" variant="outline" onClick={onCancelBatch}>
                Cancelar
              </Button>
            ) : (
              <Button
                type="button"
                className="min-h-11"
                variant="outline"
                disabled={pending || checkedCount === 0}
                onClick={clearChecked}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
