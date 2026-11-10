"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const FOCO =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-aion-blue";

function focaveisDe(raiz: HTMLElement) {
  return [...raiz.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
}

export function ModalConfirmacao({
  aberto,
  titulo,
  corpo,
  rotuloConfirmar,
  destrutivo = false,
  confirmarDesabilitado = false,
  origem,
  onFechar,
  onConfirmar,
  children,
}: {
  aberto: boolean;
  titulo: string;
  corpo: string;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  confirmarDesabilitado?: boolean;
  origem: HTMLElement | null;
  onFechar: () => void;
  onConfirmar: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const origemRef = useRef(origem);
  const fecharRef = useRef(onFechar);
  const jaAberto = useRef(false);

  useEffect(() => {
    if (origem) origemRef.current = origem;
    fecharRef.current = onFechar;
  });

  useEffect(() => {
    if (!aberto) {
      if (jaAberto.current) origemRef.current?.focus();
      jaAberto.current = false;
      return;
    }
    jaAberto.current = true;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        fecharRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focaveis = focaveisDe(dialog);
      if (!focaveis.length) {
        event.preventDefault();
        return;
      }
      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;
      const ativo = document.activeElement;
      if (event.shiftKey && (ativo === primeiro || ativo === dialog || !dialog.contains(ativo))) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && (ativo === ultimo || !dialog.contains(ativo))) {
        event.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-aion-ink/40" onClick={onFechar} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-bot-titulo"
        aria-describedby="modal-bot-corpo"
        tabIndex={-1}
        className={`relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-[var(--aion-shadow)] outline-none sm:rounded-2xl ${FOCO}`}
      >
        <h2 id="modal-bot-titulo" className="text-lg font-semibold text-aion-ink">
          {titulo}
        </h2>
        <p id="modal-bot-corpo" className="mt-2 text-sm leading-relaxed text-aion-ink">
          {corpo}
        </p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className={`min-h-11 ${FOCO}`} onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={destrutivo ? "danger" : "default"}
            className={`min-h-11 ${FOCO}`}
            disabled={confirmarDesabilitado}
            onClick={onConfirmar}
          >
            {rotuloConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
