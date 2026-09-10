"use client";

import { useEffect, useMemo, useState } from "react";
import { SalaBoard } from "@/components/sala/sala-board";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { nowInSaoPaulo } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/pbi/filters";
import { SALA_REFRESH_MS, buildSalaSnapshot } from "@/lib/pbi/sala";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, rollingYearRange } from "@/lib/pbi/volume-ec";

export default function SalaPage() {
  const today = useMemo(() => nowInSaoPaulo(), []);
  const range = useMemo(() => rollingYearRange(today), [today]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clock, setClock] = useState(() => nowInSaoPaulo());
  /** Countdown da fila/detalhe: atualiza a cada 30s (relógio visual continua em 1s). */
  const [prazoNow, setPrazoNow] = useState(() => nowInSaoPaulo());

  const osFilters: DashboardFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      from: range.fromISO,
      to: range.toISO,
      tipoManutencao: VOLUME_EC_TIPO_API,
      somenteMedicos: false,
    }),
    [range.fromISO, range.toISO],
  );

  const osQ = usePbiQuery<OsAnaliticoItem[]>("os-analitico", osFilters, {
    periodo: VOLUME_EC_PERIODO_API,
    qtdPorPagina: "100000",
  }, true, { refetchInterval: SALA_REFRESH_MS });

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
      setClock(nowInSaoPaulo());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPrazoNow(nowInSaoPaulo());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const medical = useMedicalIndex();
  const raw = dataOf(osQ.data) ?? [];
  const snapshot = useMemo(
    () =>
      medical.ready
        ? buildSalaSnapshot(raw, medical.tags, prazoNow, medical.ids, medical.equipamentoIndex)
        : buildSalaSnapshot([], new Set(), prazoNow),
    [raw, prazoNow, medical.ready, medical.tags, medical.ids, medical.equipamentoIndex],
  );
  const error = errorOf(osQ.data)?.message ?? medical.error;

  return (
    <SalaBoard
      snapshot={snapshot}
      loading={osQ.isLoading || medical.loading}
      error={error}
      dataUpdatedAt={osQ.dataUpdatedAt}
      nowMs={nowMs}
      clock={clock}
    />
  );
}
