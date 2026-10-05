"use client";

import Link from "next/link";
import {
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  NotebookPen,
  Tv,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  CADASTROS,
  CADASTROS_HUB_HREF,
  INDICADORES,
  INDICADORES_HUB_HREF,
} from "@/lib/indicadores/catalog";
import { cn } from "@/lib/utils";

type NavGroup = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  children: readonly { href: string; label: string }[];
  openKey: "sala" | "indicadores" | "cadastros";
};

const SALA_NAV = [
  { href: "/sala", label: "TV" },
  { href: "/sala/pedidos", label: "Pedidos" },
  { href: "/sala/ordens-compra", label: "Ordens de compra" },
  { href: "/sala/registros", label: "Registros" },
] as const;

const NAV_GROUPS: NavGroup[] = [
  {
    href: "/sala",
    label: "Sala",
    icon: Tv,
    children: SALA_NAV,
    openKey: "sala",
  },
  {
    href: INDICADORES_HUB_HREF,
    label: "Indicadores",
    icon: LayoutDashboard,
    children: INDICADORES,
    openKey: "indicadores",
  },
  {
    href: CADASTROS_HUB_HREF,
    label: "Cadastros",
    icon: ClipboardList,
    children: CADASTROS,
    openKey: "cadastros",
  },
];

function pathMatches(pathname: string, href: string) {
  if (href === "/sala") {
    return (
      pathname === "/sala" ||
      pathname === "/sala/registros" ||
      pathname === "/sala/pedidos" ||
      pathname === "/sala/ordens-compra" ||
      /^\/sala\/(agora|fluxo|envelhecimento|compras|programadas|ciclo-de-vida|indicadores|processos)(\/|$)/.test(
        pathname,
      )
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMenu({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const salaSubId = useId();
  const indicadoresSubId = useId();
  const cadastrosSubId = useId();

  const inSala = pathMatches(pathname, "/sala");
  const inIndicadores = pathMatches(pathname, INDICADORES_HUB_HREF);
  const inCadastros = pathMatches(pathname, CADASTROS_HUB_HREF);

  const [salaOpen, setSalaOpen] = useState(inSala);
  const [indicadoresOpen, setIndicadoresOpen] = useState(inIndicadores);
  const [cadastrosOpen, setCadastrosOpen] = useState(inCadastros);

  useEffect(() => {
    if (inSala) setSalaOpen(true);
  }, [inSala]);

  useEffect(() => {
    if (inIndicadores) setIndicadoresOpen(true);
  }, [inIndicadores]);

  useEffect(() => {
    if (inCadastros) setCadastrosOpen(true);
  }, [inCadastros]);

  const openState = {
    sala: salaOpen,
    indicadores: indicadoresOpen,
    cadastros: cadastrosOpen,
  };
  const setOpenState = {
    sala: setSalaOpen,
    indicadores: setIndicadoresOpen,
    cadastros: setCadastrosOpen,
  };
  const subIds = {
    sala: salaSubId,
    indicadores: indicadoresSubId,
    cadastros: cadastrosSubId,
  };

  return (
    <nav className="mt-1 space-y-1 px-3">
      {NAV_GROUPS.map((item) => {
        const Icon = item.icon;
        const childActive = item.children.some((child) => {
          if (child.href === "/sala") {
            return (
              pathname === "/sala" ||
              /^\/sala\/(agora|fluxo|envelhecimento|compras|programadas|ciclo-de-vida|indicadores|processos)(\/|$)/.test(
                pathname,
              )
            );
          }
          return pathMatches(pathname, child.href);
        });
        const parentExact = pathname === item.href;
        const parentActive = parentExact || childActive || pathMatches(pathname, item.href);
        const isOpen = openState[item.openKey];
        const setOpen = setOpenState[item.openKey];
        const submenuId = subIds[item.openKey];

        return (
          <div key={item.openKey}>
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
                  const active =
                    child.href === "/sala"
                      ? pathname === "/sala" ||
                        /^\/sala\/(agora|fluxo|envelhecimento|compras|programadas|ciclo-de-vida|indicadores|processos)(\/|$)/.test(
                          pathname,
                        )
                      : pathMatches(pathname, child.href);
                  const ChildIcon =
                    child.href === "/sala/registros" ||
                    child.href === "/sala/pedidos" ||
                    child.href === "/sala/ordens-compra"
                      ? NotebookPen
                      : null;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] leading-snug font-medium transition-colors",
                        active
                          ? "bg-aion-blue text-white"
                          : "text-aion-ink/70 hover:bg-aion-mist hover:text-aion-blue",
                      )}
                    >
                      {ChildIcon ? <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-80" /> : null}
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
