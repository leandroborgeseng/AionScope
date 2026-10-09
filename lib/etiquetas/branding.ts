/**
 * Branding impresso na etiqueta (logo / site / telefone / texto curto).
 * Tudo via NEXT_PUBLIC_ETIQUETA_* (inlined no build do Next).
 */
export type EtiquetaBranding = {
  brand: string;
  site: string;
  telefone: string;
  logoUrl: string;
};

const DEFAULTS: EtiquetaBranding = {
  /** Vazio por padrão — marca na etiqueta é a coluna preta AION (sem “HSJ · Eng. Clínica”). */
  brand: "",
  site: "aion.eng.br",
  telefone: "(16) 3030-0445",
  /** Marca circular na coluna preta; wordmark completo só se sobrescrito. */
  logoUrl: "/aion-mark.png",
};

export function etiquetaBranding(): EtiquetaBranding {
  return {
    brand: (process.env.NEXT_PUBLIC_ETIQUETA_BRAND ?? DEFAULTS.brand).trim(),
    site: (process.env.NEXT_PUBLIC_ETIQUETA_SITE ?? DEFAULTS.site).trim() || DEFAULTS.site,
    telefone: (process.env.NEXT_PUBLIC_ETIQUETA_TELEFONE ?? DEFAULTS.telefone).trim(),
    logoUrl: (process.env.NEXT_PUBLIC_ETIQUETA_LOGO ?? DEFAULTS.logoUrl).trim() || DEFAULTS.logoUrl,
  };
}

/** Texto de contato (tel · site) — UI/listas e rodapé da etiqueta. */
export function etiquetaContatoLine(b: EtiquetaBranding): string {
  const site = (b.site || "aion.eng.br").replace(/^www\./i, "");
  const tel = b.telefone || "(16) 3030-0445";
  return `${tel} · ${site}`;
}
