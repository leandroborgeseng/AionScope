"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

export function useChartFullscreen() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const openFullscreen = useCallback(() => setOpen(true), []);
  const closeFullscreen = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    let timer = 0;
    const frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => setReady(true), 50);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open]);

  return { open, ready, openFullscreen, closeFullscreen };
}

export function ChartFullscreenButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-aion-muted"
      aria-label="Tela cheia"
      title="Tela cheia"
      onClick={onClick}
    >
      <Maximize2 className="h-4 w-4" />
    </Button>
  );
}

export function ChartCard({
  title,
  onExpand,
  hint,
  children,
}: {
  title: string;
  onExpand?: () => void;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {onExpand ? <ChartFullscreenButton onClick={onExpand} /> : null}
      </CardHeader>
      <CardContent>
        {children}
        {hint ? <p className="mt-2 text-xs text-aion-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function ChartFullscreenDialog({
  open,
  title,
  subtitle,
  onClose,
  ready,
  chips,
  footer = "Clique no mês para ver a lista. Esc ou X para sair.",
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  ready: boolean;
  chips?: ReactNode;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} title={title} subtitle={subtitle} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 sm:px-5">
        {chips ? <div className="mb-3 flex shrink-0 flex-wrap gap-2 text-xs">{chips}</div> : null}
        <div className="min-h-0 flex-1">
          {ready ? children : <div className="h-full min-h-[280px] animate-pulse rounded-xl bg-slate-100" />}
        </div>
        <p className="mt-2 shrink-0 text-xs text-slate-500">{footer}</p>
      </div>
    </Dialog>
  );
}

export function IndicadorHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-semibold tracking-tight text-aion-ink">{title}</h2>
      {description ? <p className="mt-1 max-w-3xl text-sm text-aion-muted">{description}</p> : null}
    </div>
  );
}

export function OrigemCampo({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={valueClassName ?? "mt-1"}>{children}</dd>
    </div>
  );
}
