"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LayoutDashboard, Menu, Tv, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlobalFilters } from "@/components/filters/global-filters";
import { MedicalScopeBar } from "@/components/filters/medical-scope";

const NAV = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/cronograma", label: "Cronograma", icon: CalendarClock },
  { href: "/sala", label: "Sala", icon: Tv },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const showGlobalChrome = pathname.startsWith("/cronograma");
  const isSala = pathname === "/sala";

  if (isSala) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-teal-900/20 bg-teal-900 text-teal-50 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200">SJH · GlobalThings</p>
            <p className="text-base font-semibold">Engenharia Clínica</p>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-2 space-y-1 px-3">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-white/15 text-white" : "text-teal-100 hover:bg-white/10",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="absolute bottom-4 px-5 text-[11px] text-teal-200/80">Dashboard interno · America/Sao_Paulo</p>
      </aside>

      <div className="lg:pl-64">
        <header
          className={cn(
            "sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur",
            !showGlobalChrome && "lg:hidden",
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3 lg:hidden">
            <button onClick={() => setOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold">Indicadores EC</span>
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
