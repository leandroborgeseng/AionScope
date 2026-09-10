"use client";

import Link from "next/link";
import {
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  ShoppingCart,
  Tv,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  CADASTROS,
  CADASTROS_HUB_HREF,
  INDICADORES,
  INDICADORES_HUB_HREF,
} from "@/lib/indicadores/catalog";
import { QMENTUM_HUB_HREF, QMENTUM_NAV } from "@/lib/qmentum/checklist";
import { cn } from "@/lib/utils";

type NavGroup = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  children: readonly { href: string; label: string }[];
  openKey: "indicadores" | "cadastros" | "qmentum";
};

const NAV_GROUPS: NavGroup[] = [
  {
    href: INDICADORES_HUB_HREF,
    label: "Indicadores",
    icon: LayoutDashboard,
    children: INDICADORES,
    openKey: "indicadores",
  },
  {
    href: QMENTUM_HUB_HREF,
    label: "QMentum",
    icon: ClipboardCheck,
    children: QMENTUM_NAV,
    openKey: "qmentum",
  },
  {
    href: CADASTROS_HUB_HREF,
    label: "Cadastros",
    icon: ClipboardList,
    children: CADASTROS,
    openKey: "cadastros",
  },
];

const NAV_LINKS = [
  { href: "/cronograma", label: "Cronograma", icon: CalendarClock },
  { href: "/sala", label: "Sala", icon: Tv },
  { href: "/compras", label: "Solicitações de compra", icon: ShoppingCart },
] as const;

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMenu({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const indicadoresSubId = useId();
  const qmentumSubId = useId();
  const cadastrosSubId = useId();

  const inIndicadores = pathMatches(pathname, INDICADORES_HUB_HREF);
  const inQmentum = pathMatches(pathname, QMENTUM_HUB_HREF);
  const inCadastros = pathMatches(pathname, CADASTROS_HUB_HREF);

  const [indicadoresOpen, setIndicadoresOpen] = useState(inIndicadores);
  const [qmentumOpen, setQmentumOpen] = useState(inQmentum);
  const [cadastrosOpen, setCadastrosOpen] = useState(inCadastros);

  useEffect(() => {
    if (inIndicadores) setIndicadoresOpen(true);
  }, [inIndicadores]);

  useEffect(() => {
    if (inQmentum) setQmentumOpen(true);
  }, [inQmentum]);

  useEffect(() => {
    if (inCadastros) setCadastrosOpen(true);
  }, [inCadastros]);

  const openState = {
    indicadores: indicadoresOpen,
    qmentum: qmentumOpen,
    cadastros: cadastrosOpen,
  };
  const setOpenState = {
    indicadores: setIndicadoresOpen,
    qmentum: setQmentumOpen,
    cadastros: setCadastrosOpen,
  };
  const subIds = {
    indicadores: indicadoresSubId,
    qmentum: qmentumSubId,
    cadastros: cadastrosSubId,
  };

  return (
    <nav className="mt-1 space-y-1 px-3">
      {NAV_GROUPS.map((item) => {
        const Icon = item.icon;
        const childActive = item.children.some((child) => pathMatches(pathname, child.href));
        const parentExact = pathname === item.href;
        const parentActive = parentExact || childActive || pathMatches(pathname, item.href);
        const isOpen = openState[item.openKey];
        const setOpen = setOpenState[item.openKey];
        const submenuId = subIds[item.openKey];

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
                  parentActive && "text-aion-blue",
                )}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
              </button>
            </div>
            {isOpen ? (
              <div id={submenuId} className="mt-0.5 ml-4 space-y-0.5 border-l border-aion-line pl-2">
                {item.children.map((child) => {
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

      {NAV_LINKS.map((item) => {
        const Icon = item.icon;
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
      })}
    </nav>
  );
}
