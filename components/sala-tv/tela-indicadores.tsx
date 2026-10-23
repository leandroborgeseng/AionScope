"use client";

/**
 * Sala TV · Indicadores (/sala/indicadores) — painel de todos os indicadores do catálogo.
 * Esboço UX: /ux/aionscope/sala-indicadores-card-esboco.md · aceite I1–I15.
 * Lê só INDICADORES_SALA + RESUMOS_INDICADORES: indicador novo não muda este arquivo (I5).
 */
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { INDICADORES_SALA, indicadoresNaSala, type IndicadorSalaDef } from "@/lib/indicadores/catalog";
import {
  ariaLabelCard,
  estadoCard,
  gradeIndicadores,
  horaLeitura,
  ordenarCards,
  paginar,
  resumoCustoParque,
  rotuloStatusCard,
  type EstadoCard,
  type ResumoIndicador,
  type StatusCard,
} from "@/lib/indicadores/resumo";
import { clonesDemo, custoParqueDemo } from "@/lib/indicadores/fixture-sala-indicadores";
import { RESUMOS_INDICADORES } from "@/components/sala-tv/indicadores-resumos";

const MESES = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const COR: Record<StatusCard, { fg: string; bg: string; borda: string }> = {
  dentro: { fg: "#FFFFFF", bg: "#3E7A1E", borda: "#3E7A1E" },
  acima: { fg: "#FFFFFF", bg: "#A8460A", borda: "#A8460A" },
  "sem-dados": { fg: "#1F2A3A", bg: "#E3E8EF", borda: "#9AA6B5" },
};

function MiniGrafico({ r, altura }: { r: ResumoIndicador; altura: number }) {
  const W = 1000;
  const H = altura;
  const pad = 8;
  const topo = Math.max(r.teto ?? 0, ...r.serieMensal.map((p) => Math.max(p.valor ?? 0, p.meta ?? 0)), 0.01) * 1.1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / 11;
  const y = (v: number) => H - pad - (v / topo) * (H - 2 * pad);
  const passo = (W - 2 * pad) / 11;
  const linha = r.serieMensal
    .map((p, i) => (p.valor == null ? null : `${x(i)},${y(p.valor)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden data-testid="mini-grafico">
        {r.serieMensal.map((p, i) =>
          p.meta == null ? null : (
            <line key={`m${i}`} x1={x(i) - passo / 2} x2={x(i) + passo / 2} y1={y(p.meta)} y2={y(p.meta)}
              stroke={p.futuro ? "#C5CDD8" : "#4E6079"} strokeWidth={3} strokeDasharray="10 6" vectorEffect="non-scaling-stroke" />
          ),
        )}
        {r.teto != null ? (
          <line x1={0} x2={W} y1={y(r.teto)} y2={y(r.teto)} stroke="#4E6079" strokeWidth={2} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
        ) : null}
        {linha ? <polyline points={linha} fill="none" stroke="#0B4F8A" strokeWidth={5} vectorEffect="non-scaling-stroke" /> : null}
        {r.serieMensal.map((p, i) =>
          p.valor == null ? null : (
            <circle key={`p${i}`} cx={x(i)} cy={y(p.valor)} r={6} fill={p.meta != null && p.valor > p.meta ? "#A8460A" : "#0B4F8A"} />
          ),
        )}
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", fontSize: 18, color: "#4E6079", textAlign: "center" }}>
        {r.serieMensal.map((p, i) => (
          <span key={i} style={{ opacity: p.futuro ? 0.5 : 1 }}>
            {p.valor != null && p.meta != null && p.valor > p.meta ? "▲" : MESES[i]}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 18, color: "#4E6079", marginTop: 4 }}>── acumulado · ┄┄ meta proporcional · ··· teto {r.teto?.toLocaleString("pt-BR")}%</div>
    </div>
  );
}

function Chip({ status }: { status: StatusCard }) {
  const c = COR[status];
  return (
    <span data-testid="chip-status" style={{ fontSize: 24, fontWeight: 700, padding: "6px 16px", borderRadius: 999, background: c.bg, color: c.fg, border: `2px solid ${c.borda}`, whiteSpace: "nowrap" }}>
      {rotuloStatusCard(status)}
    </span>
  );
}

export function CardIndicadorView({ estado, def, ampliado, onAbrir }: { estado: EstadoCard; def: IndicadorSalaDef; ampliado: boolean; onAbrir?: () => void }) {
  const r = estado.tipo === "ok" ? estado.resumo : estado.tipo === "erro" ? estado.ultimo : null;
  const erro = estado.tipo === "erro";
  const status: StatusCard = r && !erro ? r.status : r ? r.status : "sem-dados";
  const href = r?.href ?? def.href;
  const titulo = r?.titulo ?? def.titulo;
  const aria = r ? ariaLabelCard(r) : `${titulo}: ${erro ? "erro ao carregar" : "carregando"}. Abrir detalhe`;
  return (
    <Link
      href={href}
      onClick={() => onAbrir?.()}
      aria-label={aria}
      className="sala-ind-card"
      data-testid={`card-${r?.id ?? def.id}`}
      data-estado={estado.tipo}
      style={{
        display: "flex", flexDirection: "column", gap: ampliado ? 18 : 10, padding: ampliado ? "32px 40px" : "20px 26px",
        background: "#fff", borderRadius: 16, color: "#1F2A3A", textDecoration: "none", minHeight: 0, overflow: "hidden",
        border: erro ? "3px dashed #A8460A" : "1px solid #D5DCE5",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#4E6079" }}>
        {titulo}{r ? ` · ${r.rotuloPeriodo}` : ""}
      </div>
      {estado.tipo === "carregando" ? (
        <div style={{ fontSize: 28, color: "#4E6079" }}>Carregando…</div>
      ) : (
        <div style={{ opacity: erro ? 0.45 : 1, display: "flex", flexDirection: "column", gap: ampliado ? 18 : 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <b data-testid="valor-principal" style={{ fontSize: ampliado ? 160 : 96, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {r && r.status !== "sem-dados" ? r.valorPrincipal : "—"}
            </b>
            <Chip status={r ? status : "sem-dados"} />
          </div>
          {r && r.status === "sem-dados" ? (
            <div style={{ fontSize: 28 }}>{r.motivoSemDados ?? "Sem dados no período"}</div>
          ) : r ? (
            <>
              {r.valorSecundario ? <div style={{ fontSize: 28, fontVariantNumeric: "tabular-nums" }}>{r.valorSecundario}</div> : null}
              {r.valorMes ? <div style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }} data-testid="valor-mes">{r.valorMes}</div> : null}
            </>
          ) : null}
          {r ? <MiniGrafico r={r} altura={ampliado ? 420 : 120} /> : null}
          {r?.meta ? <div style={{ fontSize: 22, color: "#4E6079" }}>{r.meta}</div> : null}
        </div>
      )}
      {erro ? (
        <div role="status" style={{ fontSize: 22, color: "#A8460A", fontWeight: 600 }}>
          Não foi possível atualizar{estado.ultimaLeitura != null ? ` · última leitura ${horaLeitura(estado.ultimaLeitura)}` : ""}
        </div>
      ) : null}
    </Link>
  );
}

class LimiteErro extends Component<{ def: IndicadorSalaDef; children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    if (this.state.falhou) {
      return <CardIndicadorView def={this.props.def} ampliado={false} estado={{ tipo: "erro", ultimo: null, ultimaLeitura: null, mensagem: "erro" }} />;
    }
    return this.props.children;
  }
}

const chaveUltimo = (id: string) => `sala-indicador-ultimo:${id}`;

function lerUltimo(id: string): { resumo: ResumoIndicador; em: number } | null {
  try {
    const t = window.localStorage.getItem(chaveUltimo(id));
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

/** Card ao vivo: chama o hook do resumo (RESUMOS_INDICADORES[id]); guarda a última leitura boa para o estado de erro. */
function CardAoVivo({ def, ampliado, onAbrir }: { def: IndicadorSalaDef; ampliado: boolean; onAbrir?: () => void }) {
  const usar = RESUMOS_INDICADORES[def.id];
  if (!usar) throw new Error(`resumo ausente: ${def.id}`);
  const { resumo, carregando, erro } = usar();
  const [ultimo, setUltimo] = useState<{ resumo: ResumoIndicador; em: number } | null>(() =>
    typeof window === "undefined" ? null : lerUltimo(def.id),
  );
  const bom = resumo && !carregando && !erro ? resumo : null;
  // Estado derivado durante o render (padrão React): guarda a última leitura boa.
  if (bom && ultimo?.resumo !== bom) setUltimo({ resumo: bom, em: new Date().getTime() });
  useEffect(() => {
    if (!ultimo) return;
    try {
      window.localStorage.setItem(chaveUltimo(def.id), JSON.stringify(ultimo));
    } catch {
      /* sem storage */
    }
  }, [ultimo, def.id]);
  return <CardIndicadorView def={def} ampliado={ampliado} onAbrir={onAbrir} estado={estadoCard({ carregando, erro, resumo, ultimo })} />;
}

type Demo = { n: number; estado: "ok" | "vazio" | "erro" };

function lerDemo(search: string): Demo | null {
  const q = new URLSearchParams(search);
  if (q.get("demo") !== "indicadores") return null;
  const n = Math.max(1, Math.min(12, Number(q.get("n") ?? 1) || 1));
  const e = q.get("estado");
  return { n, estado: e === "vazio" || e === "erro" ? e : "ok" };
}

function cardsDemo(d: Demo): Array<{ def: IndicadorSalaDef; estado: EstadoCard; status: StatusCard }> {
  const base = resumoCustoParque(custoParqueDemo({ valorParque: d.estado === "vazio" ? null : 50_000_000 }));
  return clonesDemo(base, d.n).map((r, i) => {
    const def: IndicadorSalaDef = { id: r.id, titulo: r.titulo, href: r.href, sala: true };
    const estado: EstadoCard =
      d.estado === "erro" && i === 0
        ? { tipo: "erro", ultimo: r, ultimaLeitura: Date.UTC(2026, 9, 23, 11, 40), mensagem: "demo" }
        : { tipo: "ok", resumo: r };
    return { def, estado, status: r.status };
  });
}

export function TelaIndicadoresSala({
  pagina = 0,
  onPaginas,
  onAbrir,
  catalogo = INDICADORES_SALA,
}: {
  /** página atual (rotação), quando há mais de 6 indicadores */
  pagina?: number;
  onPaginas?: (n: number) => void;
  /** clique no card: pausa a rotação (I15) */
  onAbrir?: () => void;
  catalogo?: readonly IndicadorSalaDef[];
}) {
  const [search, setSearch] = useState("");
  // URL só existe no cliente: lida após a hidratação (evita divergência SSR).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearch(window.location.search), []);
  const demo = useMemo(() => lerDemo(search), [search]);
  const defs = useMemo(() => indicadoresNaSala(catalogo), [catalogo]);
  const demoCards = useMemo(() => (demo ? ordenarCards(cardsDemo(demo)) : null), [demo]);
  const total = demoCards ? demoCards.length : defs.length;
  const g = gradeIndicadores(total);
  useEffect(() => onPaginas?.(Math.max(1, g.paginas)), [g.paginas, onPaginas]);
  const pag = g.paginas > 0 ? pagina % g.paginas : 0;

  if (total === 0) {
    return <div style={{ flex: 1, display: "grid", placeItems: "center", fontSize: 32, color: "#4E6079" }}>— Nenhum indicador habilitado para a Sala</div>;
  }

  const estilo = {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gap: 18,
    gridTemplateColumns: `repeat(${g.colunas}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${g.linhas}, minmax(0, 1fr))`,
  } as const;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
      <div className="sala-ind-grade" data-testid="grade-indicadores" data-colunas={g.colunas} data-paginas={g.paginas} style={estilo}>
        {demoCards
          ? paginar(demoCards, pag, g.porPagina).map((c) => (
              <CardIndicadorView key={c.def.id} def={c.def} estado={c.estado} ampliado={g.ampliado} onAbrir={onAbrir} />
            ))
          : paginar(defs, pag, g.porPagina).map((def) => (
              <LimiteErro key={def.id} def={def}>
                <CardAoVivo def={def} ampliado={g.ampliado} onAbrir={onAbrir} />
              </LimiteErro>
            ))}
      </div>
      {g.paginas > 1 ? (
        <div data-testid="paginacao" style={{ fontSize: 20, color: "#4E6079", textAlign: "right" }}>Indicadores {pag + 1}/{g.paginas}</div>
      ) : null}
    </div>
  );
}
