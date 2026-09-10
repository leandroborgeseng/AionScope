import type { OsAnaliticoItem } from "@/lib/pbi/types";

type RelatoCampo = {
  key: keyof OsAnaliticoItem;
  label: string;
  /** Texto auxiliar sob o rótulo canônico (ex.: significado de negócio). */
  subtitulo?: string;
  destaque?: boolean;
};

/** Campos de texto do solicitante / execução — Swagger ListagemAnaliticaOsDTO. */
const RELATO_CAMPOS: RelatoCampo[] = [
  {
    key: "ObservacaoDaRequisicao",
    label: "Observação da Requisição",
    subtitulo: "Problema relatado",
    destaque: true,
  },
  { key: "ObservacaoDaOS", label: "Observação da OS" },
  { key: "Servico", label: "Serviço / execução" },
];

function texto(item: OsAnaliticoItem, key: keyof OsAnaliticoItem) {
  const v = item[key];
  return typeof v === "string" ? v.trim() : "";
}

export function camposRelatoPreenchidos(item: OsAnaliticoItem) {
  return RELATO_CAMPOS.map((c) => ({ ...c, valor: texto(item, c.key) })).filter((c) => c.valor);
}

/** Bloco em destaque com relato do solicitante e textos auxiliares preenchidos. */
export function OsRelatoBloco({
  item,
  className,
}: {
  item: OsAnaliticoItem;
  className?: string;
}) {
  const campos = camposRelatoPreenchidos(item);
  const requisitante = texto(item, "Requisitante");

  if (campos.length === 0 && !requisitante) return null;

  return (
    <div className={className ?? "space-y-3 rounded-lg border border-aion-blue/25 bg-aion-mist/60 p-4"}>
      {requisitante ? (
        <p className="text-xs text-aion-muted">
          Solicitante: <span className="font-medium text-aion-ink">{requisitante}</span>
        </p>
      ) : null}
      {campos.length === 0 ? (
        <p className="text-sm text-aion-muted">Sem descrição de problema/solicitação na API.</p>
      ) : (
        campos.map((c) => (
          <div key={c.key}>
            <p
              className={
                c.destaque
                  ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-aion-blue"
                  : "text-[11px] font-semibold uppercase tracking-[0.14em] text-aion-muted"
              }
            >
              {c.label}
            </p>
            {c.subtitulo ? (
              <p className="mt-0.5 text-xs text-aion-muted">{c.subtitulo}</p>
            ) : null}
            <p
              className={
                c.destaque
                  ? "mt-1 whitespace-pre-wrap text-base font-medium leading-snug text-aion-ink"
                  : "mt-1 whitespace-pre-wrap text-sm text-aion-ink"
              }
            >
              {c.valor}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
