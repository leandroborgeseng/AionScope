"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROTA_LOGIN_ADMIN, hrefLoginAdmin } from "@/lib/auth/sessao-ui";

export const MSG_ENTRAR_PARA_VER = "Entre para ver os valores";

/** Mensagem do 401 de sessão de admin (proxy PBI, cadastros, evidências). */
export function ehErroSemSessao(mensagem: string | null | undefined) {
  return Boolean(mensagem && /senha de administrador/i.test(mensagem));
}

/** Card no lugar de valores em R$ / anexos quando não há sessão: texto + botão Entrar (voltar seguro). */
export function EntrarParaVer({ oque = "os valores", className }: { oque?: string; className?: string }) {
  const [href, setHref] = useState(ROTA_LOGIN_ADMIN);
  // A URL atual só existe no cliente.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHref(hrefLoginAdmin(`${window.location.pathname}${window.location.search}`)), []);
  return (
    <div
      role="status"
      data-testid="entrar-para-ver"
      className={className ?? "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-aion-line bg-aion-mist/40 px-4 py-3 text-sm text-aion-ink"}
    >
      <span>Entre para ver {oque}.</span>
      <Link href={href} className="rounded-md bg-aion-blue px-3 py-1.5 font-medium text-white hover:opacity-90">
        Entrar
      </Link>
    </div>
  );
}
