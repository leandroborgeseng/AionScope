"use client";

import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AionLogo } from "@/components/brand/aion-logo";
import { NavMenu } from "@/components/shell/nav-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isSalaTv =
    pathname === "/sala" ||
    (/^\/sala\/(agora|fluxo|envelhecimento|compras|programadas|ciclo-de-vida|indicadores|treinamentos|processos|evolucao)(\/|$)/.test(
      pathname,
    ) &&
      !pathname.includes("/investimentos"));

  if (isSalaTv) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-aion-ink/20 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[min(18rem,88vw)] flex-col border-r border-aion-line bg-white text-aion-ink transition-transform lg:w-64 lg:translate-x-0",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="aion-bar" />
        <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <AionLogo imgClassName="h-10" />
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-aion-blue">
              SJH · Engenharia Clínica
            </p>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-aion-mist lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavMenu pathname={pathname} onNavigate={() => setOpen(false)} />
        <p className="mt-auto px-5 pb-5 text-[11px] text-aion-muted">Dashboard interno · America/Sao_Paulo</p>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-aion-line bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-aion-mist"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <AionLogo imgClassName="h-8" />
          </div>
        </header>
        <main className="p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
