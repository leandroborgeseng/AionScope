"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DICA_REQUER_LOGIN, ROTA_LOGIN_ADMIN, hrefLoginAdmin } from "@/lib/auth/sessao-ui";

/** Aviso + link para entrar como admin, voltando a esta página depois do login. */
export function AvisoLoginAdmin({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [href, setHref] = useState(ROTA_LOGIN_ADMIN);
  // A URL atual só existe no cliente.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHref(hrefLoginAdmin(`${window.location.pathname}${window.location.search}`)), []);
  return (
    <p role="status" data-testid="aviso-login-admin" className={className} style={style}>
      {DICA_REQUER_LOGIN}.{" "}
      <Link href={href} style={{ textDecoration: "underline" }}>
        Entrar como admin
      </Link>
    </p>
  );
}
