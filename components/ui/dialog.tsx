"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

export function Dialog({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:p-3">
      <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-label="Fechar tela cheia" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-fullscreen-title"
        className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-aion-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="chart-fullscreen-title" className="text-lg font-semibold text-aion-ink">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-aion-muted">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar tela cheia">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
