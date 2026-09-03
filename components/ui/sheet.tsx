"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

export function Sheet({
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Fechar" />
      <aside className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar detalhe">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
