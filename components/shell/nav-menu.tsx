"use client";

import Link from "next/link";
import { CalendarClock, ChevronDown, ClipboardList, LayoutDashboard, Tv } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  CADASTROS,
  CADASTROS_HUB_HREF,
  INDICADORES,
  INDICADORES_HUB_HREF,
} from "@/lib/indicadores/catalog";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: INDICADORES_HUB_HREF,
    label: "Indicadores",
    icon: LayoutDashboard,
    children: INDICADORES,
    openKey: "indicadores" as const,
  },
  {
    href: CADASTROS_HUB_HREF,
    label: "Cadastros",
    icon: ClipboardList,
    children: CADASTROS,
    openKey: "cadastros" as const,
  },
  { href: "/cronograma", label: "Cronograma", icon: CalendarClock },
  { href: "/sala", label: "Sala", icon: Tv },
] as const;

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMenu({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const indicadoresSubId = useId();
  const cadastrosSubId = useId();
  const inIndicadores = pathMatches(pathname, INDICADORES_HUB_HREF);
  const inCadastros = pathMatches(pathname, CADASTROS_HUB_HREF);
  const [indicadoresOpen, setIndicadoresOpen] = useState(inIndicadores);
  const [cadastrosOpen, setCadastrosOpen] = useState(inCadastros);

  useEffect(() => {
    if (inIndicadores) setIndicadoresOpen(true);
  }, [inIndicadores]);

  useEffect(() => {
    if (inCadastros) setCadastrosOpen(true);
  }, [inCadastros]);

  return (
    <nav className="mt-1 space-y-1 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const children = "children" in item ? item.children : undefined;
        const childActive = children?.some((child) => pathMatches(pathname, child.href)) ?? false;
        const parentExact = pathname === item.href;
        const parentActive = parentExact || childActive;

        if (!children || !("openKey" in item)) {
          const active = pathMatches(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-aion-blue text-white"
                  : "text-aion-ink/75 hover:bg-aion-mist hover:text-aion-blue",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        }

        const openKey = item.openKey;
        const isOpen = openKey === "indicadores" ? indicadoresOpen : cadastrosOpen;
        const setOpen = openKey === "indicadores" ? setIndicadoresOpen : setCadastrosOpen;
        const submenuId = openKey === "indicadores" ? indicadoresSubId : cadastrosSubId;

        return (
          <div key={item.href}>
            <div className="flex items-center gap-0.5">
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={parentExact ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  parentExact
                    ? "bg-aion-blue text-white"
                    : parentActive
                      ? "bg-aion-mist text-aion-blue"
                      : "text-aion-ink/75 hover:bg-aion-mist hover:text-aion-blue",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={submenuId}
                aria-label={isOpen ? `Recolher ${item.label}` : `Expandir ${item.label}`}
                onClick={() => setOpen((open) => !open)}
                className={cn(
                  "rounded-lg p-2 text-aion-ink/60 transition-colors hover:bg-aion-mist hover:text-aion-blue",
                  parentActive && !parentExact && "text-aion-blue",
                  parentExact && "text-aion-blue",
                )}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
              </button>
            </div>
            {isOpen ? (
              <div id={submenuId} className="mt-0.5 ml-4 space-y-0.5 border-l border-aion-line pl-2">
                {children.map((child) => {
                  const active = pathMatches(pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-lg px-3 py-2 text-[13px] leading-snug font-medium transition-colors",
                        active
                          ? "bg-aion-blue text-white"
                          : "text-aion-ink/70 hover:bg-aion-mist hover:text-aion-blue",
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
