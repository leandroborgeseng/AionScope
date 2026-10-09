import { absoluteFichaVidaUrl } from "./agregar-plano";

/**
 * Destino do QR nas etiquetas Niimbot.
 *
 * A API PBI de equipamentos **não** devolve URL/link do portal Effort
 * (só Id, Tag, CodigoCliente vazio, etc.). O deep link precisa ser
 * configurado manualmente via template.
 *
 * Env (NEXT_PUBLIC_* — embutido no bundle):
 * - `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` — ex.:
 *   `{base}/#/equipamento/{Id}` ou `https://sjh.globalthings.net/?tag={Tag}`
 * - `NEXT_PUBLIC_ETIQUETA_QR_BASE` — valor de `{base}`, ou (sem template)
 *   URL-base que vira `{base}/{Tag}` (ou template se contiver `{…}`).
 *
 * Placeholders: `{Id}`, `{Tag}`, `{CodigoCliente}`, `{base}`.
 * Sem template válido → ficha vida AionScope (`/equipamentos/{tag}`).
 */

export type EtiquetaQrContext = {
  tag: string;
  /** Id interno GlobalThings (equipamentos.Id). */
  id?: number | null;
  codigoCliente?: string | null;
  fichaVidaPath: string;
  /** Origin do browser / NEXT_PUBLIC_APP_URL para ficha absoluta. */
  origin?: string;
};

export type EtiquetaQrSource = "effort-template" | "ficha-vida";

export type EtiquetaQrResolved = {
  url: string;
  source: EtiquetaQrSource;
  /** Sempre disponível (fallback / link secundário na UI). */
  fichaVidaUrl: string;
};

const DEFAULT_PORTAL_BASE = "https://sjh.globalthings.net";

export function effortPortalBase(): string {
  const fromQr = (process.env.NEXT_PUBLIC_ETIQUETA_QR_BASE ?? "").trim();
  if (fromQr && !fromQr.includes("{")) {
    return fromQr.replace(/\/$/, "");
  }
  const fromPbi = (process.env.NEXT_PUBLIC_PBI_BASE_URL ?? "").trim();
  if (fromPbi) return fromPbi.replace(/\/$/, "");
  return DEFAULT_PORTAL_BASE;
}

/** Template bruto configurado (pode ser vazio). */
export function effortEquipamentoUrlTemplate(): string {
  const tpl = (process.env.NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE ?? "").trim();
  if (tpl) return tpl;
  const base = (process.env.NEXT_PUBLIC_ETIQUETA_QR_BASE ?? "").trim();
  if (!base) return "";
  if (base.includes("{")) return base;
  // Só base → path por Tag (padrão seguro sem Id).
  return `${base.replace(/\/$/, "")}/{Tag}`;
}

function needsPlaceholder(template: string, name: string): boolean {
  return template.includes(`{${name}}`);
}

/**
 * Substitui placeholders. Retorna null se o template exige Id/CodigoCliente
 * ausente (evita QR quebrado).
 */
export function applyEffortUrlTemplate(
  template: string,
  ctx: Pick<EtiquetaQrContext, "tag" | "id" | "codigoCliente">,
  base = effortPortalBase(),
): string | null {
  const tpl = template.trim();
  if (!tpl) return null;

  const tag = (ctx.tag ?? "").trim();
  if (!tag) return null;

  if (needsPlaceholder(tpl, "Id") && (ctx.id == null || !Number.isFinite(ctx.id))) {
    return null;
  }
  const codigo = (ctx.codigoCliente ?? "").trim();
  if (needsPlaceholder(tpl, "CodigoCliente") && !codigo) {
    return null;
  }

  const idStr = ctx.id != null && Number.isFinite(ctx.id) ? String(ctx.id) : "";
  const tagEnc = encodeURIComponent(tag);
  const codigoEnc = encodeURIComponent(codigo);

  return tpl
    .replaceAll("{base}", base.replace(/\/$/, ""))
    .replaceAll("{Id}", idStr)
    .replaceAll("{Tag}", tagEnc)
    .replaceAll("{CodigoCliente}", codigoEnc);
}

export function resolveEtiquetaQrUrl(ctx: EtiquetaQrContext): EtiquetaQrResolved {
  const fichaVidaUrl = absoluteFichaVidaUrl(ctx.fichaVidaPath, ctx.origin);
  const template = effortEquipamentoUrlTemplate();
  if (template) {
    const effort = applyEffortUrlTemplate(template, ctx);
    if (effort) {
      return { url: effort, source: "effort-template", fichaVidaUrl };
    }
  }
  return { url: fichaVidaUrl, source: "ficha-vida", fichaVidaUrl };
}
