"use client";

import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AionLogo } from "@/components/brand/aion-logo";
import { GlobalFilters } from "@/components/filters/global-filters";
import { MedicalScopeBar } from "@/components/filters/medical-scope";
import { NavMenu } from "@/components/shell/nav-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const showGlobalChrome = pathname.startsWith("/cronograma");
  const isSala = pathname === "/sala";

  if (isSala) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-aion-ink/20 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-aion-line bg-white text-aion-ink transition-transform lg:translate-x-0",
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
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavMenu pathname={pathname} onNavigate={() => setOpen(false)} />
        <p className="mt-auto px-5 pb-5 text-[11px] text-aion-muted">Dashboard interno · America/Sao_Paulo</p>
      </aside>

      <div className="lg:pl-64">
        <header
          className={cn(
            "sticky top-0 z-30 border-b border-aion-line bg-white/95 backdrop-blur",
            !showGlobalChrome && "lg:hidden",
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3 lg:hidden">
            <button onClick={() => setOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <AionLogo imgClassName="h-8" />
          </div>
          {showGlobalChrome ? (
            <>
              <GlobalFilters />
              <MedicalScopeBar />
            </>
          ) : null}
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
